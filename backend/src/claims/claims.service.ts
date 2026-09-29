import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SummaryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class ClaimsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  // A claim wraps one Course in the Ward entry for processor review. It can be
  // opened before the physician has approved the summary: the claim is then
  // addressed to the attending physician and stays PENDING until they approve
  // it (via the Requests view or the workspace). An already-approved summary
  // starts VALIDATED, so CF4 can be generated straight away.
  async createFromSummary(courseInWardId: string, claimsProcessorId: string) {
    const summary = await this.prisma.courseInWard.findUnique({
      where: { id: courseInWardId },
      include: {
        requests: { select: { id: true } },
        orders: {
          take: 1,
          orderBy: { dateCreated: 'asc' },
          select: { orderedById: true, admission: { select: { physicianId: true } } },
        },
      },
    });
    if (!summary) throw new NotFoundException('Course in the Ward summary not found');
    if (summary.requests.length > 0) {
      throw new ConflictException('A claim already exists for this summary');
    }

    const firstOrder = summary.orders[0];
    const physicianId =
      summary.validatorId ?? firstOrder?.admission.physicianId ?? firstOrder?.orderedById;
    if (!physicianId) {
      throw new BadRequestException('Summary has no attending physician to validate it');
    }

    const approved = summary.status === SummaryStatus.APPROVED && Boolean(summary.approvedStatus);
    const claim = await this.prisma.summaryApprovalRequest.create({
      data: {
        summaryId: courseInWardId,
        physicianId,
        processorId: claimsProcessorId,
        status: approved ? 'VALIDATED' : 'PENDING',
      },
    });

    await this.auditLog.record({
      userId: claimsProcessorId,
      action: 'CLAIM_CREATED',
    });

    return claim;
  }

  /** Summaries no claim has been opened for yet -- the claims processor's intake list. */
  findEligibleSummaries() {
    return this.prisma.courseInWard.findMany({
      where: { requests: { none: {} } },
      orderBy: { summaryDate: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        orders: {
          take: 1,
          orderBy: { dateCreated: 'asc' },
          select: {
            dateCreated: true,
            orderedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  findAll() {
    return this.prisma.summaryApprovalRequest.findMany({
      orderBy: { id: 'desc' },
      include: {
        summary: {
          include: {
            patient: true,
            orders: {
              orderBy: { dateCreated: 'desc' },
              include: {
                admission: { select: { admissionDate: true, dischargeDate: true } },
                orderedBy: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
  }

  findForPhysician(physicianId: string) {
    return this.prisma.summaryApprovalRequest.findMany({
      where: { physicianId },
      orderBy: { requestedAt: 'desc' },
      include: {
        processor: { select: { firstName: true, lastName: true, role: true } },
        summary: {
          include: {
            patient: true,
            orders: {
              orderBy: { dateCreated: 'desc' },
              include: { orderedBy: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    });
  }

  async approveForPhysician(id: string, physicianId: string) {
    const request = await this.prisma.summaryApprovalRequest.findFirst({
      where: { id, physicianId },
    });
    if (!request) throw new NotFoundException('Physician request not found');

    const [summary, updatedRequest] = await this.prisma.$transaction([
      this.prisma.courseInWard.update({
        where: { id: request.summaryId },
        data: {
          status: SummaryStatus.APPROVED,
          approvedStatus: true,
          validatorId: physicianId,
          validatedAt: new Date(),
        },
      }),
      this.prisma.summaryApprovalRequest.update({
        where: { id },
        data: { status: 'VALIDATED' },
      }),
    ]);

    await this.auditLog.record({ userId: physicianId, action: 'SUMMARY_APPROVED' });
    return { ...updatedRequest, summary };
  }

  // Claims processor notifies the attending physician to validate the entry
  async notifyPhysician(claimId: string, claimsProcessorId: string) {
    let claim;
    try {
      claim = await this.prisma.summaryApprovalRequest.update({
        where: { id: claimId },
        data: {
          status: 'PHYSICIAN_VALIDATION_REQUESTED',
        },
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException('Claim not found');
      }
      throw error;
    }

    // TODO: wire to an actual notification channel (in-app alert / pager
    // integration) -- out of scope for this scaffold.
    await this.auditLog.record({
      userId: claimsProcessorId,
      action: 'CLAIM_PHYSICIAN_NOTIFIED',
    });

    return claim;
  }

  // Auto-populate CF4 (PhilHealth Claim Form 4) with the approved Course in
  // the Ward summary. Only allowed once the physician has approved it.
  async generateCf4(claimId: string, claimsProcessorId: string) {
    const claim = await this.prisma.summaryApprovalRequest.findUnique({
      where: { id: claimId },
      include: { summary: { include: { patient: true } } },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.summary.status !== SummaryStatus.APPROVED || !claim.summary.approvedStatus) {
      throw new BadRequestException(
        'Course in the Ward must be physician-approved before CF4 can be generated',
      );
    }

    const updated = await this.prisma.summaryApprovalRequest.update({
      where: { id: claimId },
      data: { status: 'CF4_GENERATED' },
    });

    await this.auditLog.record({
      userId: claimsProcessorId,
      action: 'CF4_GENERATED',
    });

    // The actual CF4 document (PDF) would be rendered here from
    // claim.courseInWard.currentText + patient + physician data.
    // Returning the populated fields for now -- wire to a PDF template
    // (see /mnt/skills/public/pdf equivalent tooling on the doc-generation
    // side of this project) when building the real CF4 output.
    return {
      claim: updated,
      cf4Fields: {
        patientName: `${claim.summary.patient.firstName} ${claim.summary.patient.lastName}`,
        courseInTheWard: claim.summary.summaryContent,
      },
    };
  }
}
