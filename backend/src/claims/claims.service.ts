import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, OrderStatus, SummaryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, dayLabel, detailItems, fullName } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { triageSelect } from '../patients/patients.service';
import { assertAttending, loadSummaryAdmission } from '../course-in-ward/summary-access';
import { dayKeyOf } from '../course-in-ward/course-in-ward.service';
import { createClaimOnce } from './claim-once';

/**
 * Which days of a stay still block its CF4 (`YYYY-MM-DD`, server-local, oldest first).
 * - `missingDays`: finished orders that day, but no Course in the Ward dated that day.
 *   A summary linked to orders from other days does not cover those days.
 * - `unrequestedDays`: a summary exists that day but no claim has been opened on it.
 * - `unapprovedDays`: a summary that day is not physician-approved.
 * - `incompleteDays`: approved, but a finished order that day is in no summary
 *   (finished after approval); the physician regenerates and re-approves it.
 */
export interface StayCoverage {
  missingDays: string[];
  unrequestedDays: string[];
  unapprovedDays: string[];
  incompleteDays: string[];
}

const EMPTY_COVERAGE: StayCoverage = {
  missingDays: [],
  unrequestedDays: [],
  unapprovedDays: [],
  incompleteDays: [],
};

@Injectable()
export class ClaimsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private notifications: NotificationsService,
  ) {}

  // A claim wraps one Course in the Ward entry for processor review. When the
  // claims processor files it, an unapproved day is PHYSICIAN_VALIDATION_REQUESTED
  // so the attending can approve from Requests. Discharge auto-opens stay as
  // PENDING until claims explicitly requests validation. Already-approved
  // summaries start VALIDATED so CF4 can be generated straight away.
  async createFromSummary(courseInWardId: string, claimsProcessorId: string) {
    const opened = await this.openClaim(courseInWardId, claimsProcessorId);
    if (!opened.approved) {
      const processorName = await this.auditLog.userLabel(claimsProcessorId);
      await this.notifications.create({
        userId: opened.physicianId,
        type: NotificationType.REVIEW_REQUESTED,
        title: 'Course in the Ward review requested',
        message: `**${processorName}** (Claims Processor) requested a review of **${opened.patientName}**'s Course in the Ward for ${dayLabel(opened.summaryDate)}.`,
        requestId: opened.claim.id,
      });
    }
    return opened.claim;
  }

  /**
   * One request for a whole stay: opens a claim on every listed day not yet
   * claimed, then asks each physician once for the days still waiting on them.
   */
  async createForStay(courseInWardIds: string[], claimsProcessorId: string) {
    const opened: Awaited<ReturnType<ClaimsService['openClaim']>>[] = [];
    for (const id of new Set(courseInWardIds)) {
      try {
        opened.push(await this.openClaim(id, claimsProcessorId));
      } catch (err) {
        if (!(err instanceof ConflictException)) throw err;
      }
    }
    if (!opened.length) throw new ConflictException('Every day of this stay already has a claim');

    const pendingByPhysician = new Map<string, typeof opened>();
    for (const entry of opened) {
      if (entry.approved) continue;
      pendingByPhysician.set(entry.physicianId, [...(pendingByPhysician.get(entry.physicianId) ?? []), entry]);
    }
    if (pendingByPhysician.size) {
      const processorName = await this.auditLog.userLabel(claimsProcessorId);
      for (const [physicianId, entries] of pendingByPhysician) {
        const days = entries.map((entry) => dayLabel(entry.summaryDate)).join(', ');
        await this.notifications.create({
          userId: physicianId,
          type: NotificationType.REVIEW_REQUESTED,
          title: 'Course in the Ward review requested',
          message: `**${processorName}** (Claims Processor) requested a review of **${entries[0].patientName}**'s stay (${entries.length} ${entries.length === 1 ? 'day' : 'days'}: ${days}).`,
          requestId: entries[0].claim.id,
        });
      }
    }
    return opened.map((entry) => entry.claim);
  }

  /** Validates and opens one day's claim, without notifying anyone. */
  private async openClaim(courseInWardId: string, claimsProcessorId: string) {
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

    // A claim (and so a CF4) covers a finished stay: never open one mid-stay.
    const admission = await loadSummaryAdmission(this.prisma, courseInWardId);
    if (!admission?.dischargeDate) {
      throw new BadRequestException('A claim can only be opened after the patient is discharged');
    }

    const approved = summary.status === SummaryStatus.APPROVED && Boolean(summary.approvedStatus);

    // Only the attending physician can approve, so an open request goes to them
    // (never to whoever happened to write the first order).
    const attendingId = summary.orders[0]?.admission.physicianId ?? admission.physicianId ?? null;
    const physicianId = approved ? summary.validatorId ?? attendingId : attendingId;
    if (!physicianId) {
      throw new BadRequestException('Summary has no attending physician to validate it');
    }
    const claim = await createClaimOnce(this.prisma, {
      summaryId: courseInWardId,
      physicianId,
      processorId: claimsProcessorId,
      status: approved ? 'VALIDATED' : 'PHYSICIAN_VALIDATION_REQUESTED',
    });
    if (!claim) throw new ConflictException('A claim already exists for this summary');

    const patientName = await this.auditLog.patientName({ summaryId: courseInWardId });
    await this.auditLog.record({
      userId: claimsProcessorId,
      action: 'CLAIM_CREATED',
      details: {
        summary: `Filed a claim for ${patientName}'s summary (${dayLabel(summary.summaryDate)})`,
        items: detailItems([
          ['Patient', patientName],
          ['Summary day', dayLabel(summary.summaryDate)],
          ['Validating physician', await this.auditLog.userLabel(physicianId)],
          [
            'Claim status',
            approved ? 'Validated (summary already approved)' : 'Physician validation requested',
          ],
        ]),
      },
    });

    return { claim, approved, physicianId, patientName, summaryDate: summary.summaryDate };
  }

  /**
   * Course in the Ward days the claims processor can still request: the stay
   * has been discharged, and no claim has been opened for that day yet.
   */
  findEligibleSummaries() {
    return this.prisma.courseInWard.findMany({
      where: {
        requests: { none: {} },
        orders: { some: { admission: { dischargeDate: { not: null } } } },
      },
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
            admission: {
              select: {
                dischargeDate: true,
                physician: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
  }

  /** `StayCoverage` per admission id. */
  async stayCoverage(admissionIds: string[]): Promise<Map<string, StayCoverage>> {
    const ids = [...new Set(admissionIds)];
    const [orders, summaries] = await Promise.all([
      this.prisma.physicianOrder.findMany({
        where: { admissionId: { in: ids }, status: OrderStatus.FINISHED, active: true },
        select: { admissionId: true, dateCreated: true, summarizationId: true },
      }),
      this.prisma.courseInWard.findMany({
        where: { orders: { some: { admissionId: { in: ids } } } },
        select: {
          summaryDate: true,
          status: true,
          approvedStatus: true,
          requests: { select: { id: true }, take: 1 },
          orders: { select: { admissionId: true } },
        },
      }),
    ]);

    type Day = { summarized: boolean; requested: boolean; approved: boolean; unlinked: boolean };
    const stays = new Map<string, Map<string, Day>>(ids.map((id) => [id, new Map()]));
    const dayOf = (admissionId: string, day: string) => {
      const days = stays.get(admissionId)!;
      const entry = days.get(day) ?? { summarized: false, requested: true, approved: true, unlinked: false };
      days.set(day, entry);
      return entry;
    };

    for (const order of orders) {
      const day = dayKeyOf(order.dateCreated);
      if (day) dayOf(order.admissionId, day).unlinked ||= !order.summarizationId;
    }
    for (const summary of summaries) {
      const day = dayKeyOf(summary.summaryDate);
      if (!day) continue;
      for (const admissionId of new Set(summary.orders.map((order) => order.admissionId))) {
        if (!stays.has(admissionId)) continue;
        const entry = dayOf(admissionId, day);
        entry.summarized = true;
        entry.requested &&= summary.requests.length > 0;
        entry.approved &&= summary.status === SummaryStatus.APPROVED && Boolean(summary.approvedStatus);
      }
    }

    const coverage = new Map<string, StayCoverage>();
    for (const [admissionId, days] of stays) {
      const sorted = [...days].sort(([a], [b]) => a.localeCompare(b));
      const pick = (test: (day: Day) => boolean) => sorted.filter(([, day]) => test(day)).map(([key]) => key);
      coverage.set(admissionId, {
        missingDays: pick((day) => !day.summarized),
        unrequestedDays: pick((day) => day.summarized && !day.requested),
        unapprovedDays: pick((day) => day.summarized && !day.approved),
        incompleteDays: pick((day) => day.summarized && day.approved && day.unlinked),
      });
    }
    return coverage;
  }

  /** Every claim, each with its stay's `StayCoverage` (`stay`). */
  async findAll() {
    const claims = await this.findAllClaims();
    const coverage = await this.stayCoverage(
      claims.flatMap((claim) => claim.summary.orders.map((order) => order.admissionId)),
    );
    return claims.map((claim) => {
      const admissionId = claim.summary.orders[0]?.admissionId;
      return { ...claim, stay: (admissionId && coverage.get(admissionId)) || EMPTY_COVERAGE };
    });
  }

  private findAllClaims() {
    return this.prisma.summaryApprovalRequest.findMany({
      orderBy: { requestedAt: 'desc' },
      include: {
        summary: {
          include: {
            patient: true,
            orders: {
              orderBy: { dateCreated: 'desc' },
              include: {
                admission: {
                  select: {
                    id: true,
                    admissionDate: true,
                    dischargeDate: true,
                    patientClass: true,
                    // The claim review and the CF4 show the stay, not only the day.
                    initialAssessment: true,
                    medicalSurgicalHistory: true,
                    // Snapshots survive discharge; live `room` is only while occupied.
                    roomNumber: true,
                    wardName: true,
                    physician: { select: { firstName: true, lastName: true } },
                    room: { select: { number: true, ward: { select: { name: true } } } },
                    triage: triageSelect,
                  },
                },
                orderedBy: { select: { firstName: true, lastName: true } },
                // Who the nurse executed the order and when -- the claims
                // timeline shows the same execution state as the physician's.
                executedBy: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Claims requests for the signed-in physician — attending only.
   * Consulting physicians do not see or approve claim requests for patients
   * where they are only on the care team as a consultant.
   */
  findForPhysician(physicianId: string) {
    return this.prisma.summaryApprovalRequest.findMany({
      where: {
        physicianId,
        // PENDING = claim opened (e.g. on discharge) but claims has not asked
        // for validation yet — hide those until they request.
        status: { not: 'PENDING' },
        // Belt-and-suspenders: the request must also belong to an admission
        // this physician currently attends (not merely consults on).
        summary: {
          orders: {
            some: {
              admission: { physicianId },
            },
          },
        },
      },
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
    if (request.status !== 'PHYSICIAN_VALIDATION_REQUESTED') {
      throw new BadRequestException(
        'Claims has not requested physician validation for this claim yet',
      );
    }
    await assertAttending(this.prisma, request.summaryId, physicianId);

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

    const patientName = await this.auditLog.patientName({ summaryId: request.summaryId });
    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_APPROVED',
      details: {
        summary: `Approved ${patientName}'s summary for ${dayLabel(summary.summaryDate)} from a claim request`,
        items: detailItems([
          ['Patient', patientName],
          ['Summary day', dayLabel(summary.summaryDate)],
        ]),
      },
    });
    const physicianName = await this.auditLog.userLabel(physicianId);
    await this.notifications.notifyUsers([request.processorId], {
      type: NotificationType.REVIEW_REQUESTED,
      title: 'Course in the Ward summary approved',
      message: `**${physicianName}** approved **${patientName}**'s Course in the Ward for ${dayLabel(summary.summaryDate)}. It is ready for CF4 processing.`,
      requestId: request.id,
    });
    return { ...updatedRequest, summary };
  }

  // Claims processor notifies the attending physician to validate the entry.
  // The reminder lands on the physician's notification bell, carrying the
  // message typed in the review modal.
  async notifyPhysician(claimId: string, claimsProcessorId: string, message?: string) {
    const existing = await this.prisma.summaryApprovalRequest.findUnique({
      where: { id: claimId },
      include: {
        summary: { include: { patient: { select: { firstName: true, lastName: true } } } },
        processor: { select: { firstName: true, lastName: true } },
      },
    });
    if (!existing) throw new NotFoundException('Claim not found');

    const claim = await this.prisma.summaryApprovalRequest.update({
      where: { id: claimId },
      data: {
        status: 'PHYSICIAN_VALIDATION_REQUESTED',
      },
    });

    const patientName =
      `${existing.summary.patient.firstName} ${existing.summary.patient.lastName}`.trim();
    const processorName =
      `${existing.processor.firstName} ${existing.processor.lastName}`.trim();
    const note = message?.trim();
    const again = existing.status === 'PHYSICIAN_VALIDATION_REQUESTED';

    const day = dayLabel(existing.summary.summaryDate);
    await this.notifications.create({
      userId: existing.physicianId,
      type: NotificationType.REVIEW_REQUESTED,
      title: again ? 'Review requested again' : 'Course in the Ward review requested',
      message: note
        ? `**${processorName}** (Claims Processor) requested ${again ? 'another review' : 'a review'} of **${patientName}**'s Course in the Ward for ${day}: "${note}"`
        : `**${processorName}** (Claims Processor) requested ${again ? 'another review' : 'a review'} of **${patientName}**'s Course in the Ward for ${day}.`,
      requestId: claimId,
    });

    await this.auditLog.record({
      userId: claimsProcessorId,
      action: 'CLAIM_PHYSICIAN_NOTIFIED',
      details: {
        summary: `Asked ${await this.auditLog.userLabel(existing.physicianId)} to review ${patientName}'s summary`,
        items: detailItems([
          ['Patient', patientName],
          ['Physician', await this.auditLog.userLabel(existing.physicianId)],
          ['Message', note],
        ]),
      },
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
    // Claims opened before the discharge rule existed may still be mid-stay.
    if (!(await loadSummaryAdmission(this.prisma, claim.summaryId))?.dischargeDate) {
      throw new BadRequestException('CF4 can only be generated after the patient is discharged');
    }
    // The CF4 covers the whole stay, so every day of it must be summarized,
    // requested and approved -- not only the day this claim is on.
    const source = await this.prisma.physicianOrder.findFirst({
      where: { summarizationId: claim.summaryId },
      select: { admissionId: true },
    });
    if (source) {
      const stay = (await this.stayCoverage([source.admissionId])).get(source.admissionId)!;
      const blockers = [
        ['no Course in the Ward', stay.missingDays],
        ['no claim requested', stay.unrequestedDays],
        ['not physician-approved', stay.unapprovedDays],
        ['an order missing from the approved summary', stay.incompleteDays],
      ] as const;
      const reasons = blockers
        .filter(([, days]) => days.length)
        .map(([label, days]) => `${label} for ${days.join(', ')}`);
      if (reasons.length) {
        throw new BadRequestException(`CF4 needs every day of the stay summarized and approved: ${reasons.join('; ')}`);
      }
    }

    const updated = await this.prisma.summaryApprovalRequest.update({
      where: { id: claimId },
      data: { status: 'CF4_GENERATED' },
    });

    await this.auditLog.record({
      userId: claimsProcessorId,
      action: 'CF4_GENERATED',
      details: {
        summary: `Generated the PhilHealth CF4 for ${fullName(claim.summary.patient)}`,
        items: detailItems([
          ['Patient', fullName(claim.summary.patient)],
          ['Summary day', dayLabel(claim.summary.summaryDate)],
        ]),
      },
    });
    await this.notifications.notifyUsers([claim.physicianId], {
      title: 'CF4 generated',
      message: `A PhilHealth CF4 was generated for **${fullName(claim.summary.patient)}**'s summary for ${dayLabel(claim.summary.summaryDate)}.`,
      requestId: claim.id,
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
