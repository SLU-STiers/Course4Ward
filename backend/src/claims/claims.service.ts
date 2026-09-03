import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SummaryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class ClaimsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  // A claim wraps one approved (or pending) Course in the Ward entry for
  // processor review. Created once a summary exists for a patient.
  async createFromSummary(courseInWardId: string, claimsProcessorId: string) {
    const summary = await this.prisma.courseInWard.findUnique({
      where: { id: courseInWardId },
    });
    if (!summary) throw new NotFoundException('Course in the Ward summary not found');

    if (!summary.validatorId) throw new BadRequestException('Summary has no validating physician');

    const claim = await this.prisma.summaryApprovalRequest.create({
      data: {
        summaryId: courseInWardId,
        physicianId: summary.validatorId,
        processorId: claimsProcessorId,
      },
    });

    await this.auditLog.record({
      userId: claimsProcessorId,
      action: 'CLAIM_CREATED',
    });

    return claim;
  }

  findAll() {
    return this.prisma.summaryApprovalRequest.findMany({
      orderBy: { id: 'desc' },
      include: {
        summary: { include: { patient: true } },
      },
    });
  }

  // Claims processor notifies the attending physician to validate the entry
  async notifyPhysician(claimId: string, claimsProcessorId: string) {
    const claim = await this.prisma.summaryApprovalRequest.update({
      where: { id: claimId },
      data: {
        status: 'PHYSICIAN_VALIDATION_REQUESTED',
      },
    });

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
