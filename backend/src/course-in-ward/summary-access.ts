import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** The admission fields that decide who may work on a summary. */
export interface CareTeamAdmission {
  id: string;
  admissionDate: Date;
  dischargeDate: Date | null;
  physicianId: string | null;
  additionalPhysicians: { physicianId: string }[];
}

/** Manila calendar day `YYYY-MM-DD` for once-per-day consulting notices. */
export function manilaDayKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
}

export function isAttending(admission: CareTeamAdmission | null, physicianId: string) {
  return !!admission?.physicianId && admission.physicianId === physicianId;
}

export function isConsultingOnly(admission: CareTeamAdmission | null, physicianId: string) {
  return (
    !!admission &&
    !isAttending(admission, physicianId) &&
    admission.additionalPhysicians.some((p) => p.physicianId === physicianId)
  );
}

export const CARE_TEAM_ADMISSION_SELECT = {
  id: true,
  admissionDate: true,
  dischargeDate: true,
  physicianId: true,
  additionalPhysicians: { select: { physicianId: true } },
} as const;

/**
 * The admission a Course in the Ward belongs to: the admission of its linked
 * orders, else the admission that covered its day, else the patient's latest.
 * A summary has no admission column of its own, so every access check goes
 * through this one rule.
 */
export function summaryAdmission<A extends CareTeamAdmission>(
  summary: { summaryDate: Date | string; orders?: { admissionId?: string | null }[] },
  admissions: A[],
): A | null {
  const linkedId = summary.orders?.find((order) => order.admissionId)?.admissionId;
  const linked = linkedId ? admissions.find((a) => a.id === linkedId) : undefined;
  if (linked) return linked;

  const dayStart = new Date(summary.summaryDate);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const byNewest = [...admissions].sort(
    (a, b) => new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime(),
  );
  return (
    byNewest.find(
      (a) =>
        new Date(a.admissionDate) < dayEnd &&
        (!a.dischargeDate || new Date(a.dischargeDate) >= dayStart),
    ) ??
    byNewest[0] ??
    null
  );
}

export function isOnCareTeam(admission: CareTeamAdmission | null, physicianId: string) {
  return (
    !!admission &&
    (admission.physicianId === physicianId ||
      admission.additionalPhysicians.some((p) => p.physicianId === physicianId))
  );
}

/** Loads the summary's admission (with its care team). */
export async function loadSummaryAdmission(prisma: PrismaService, summaryId: string) {
  const summary = await prisma.courseInWard.findUnique({
    where: { id: summaryId },
    select: {
      summaryDate: true,
      orders: { select: { admissionId: true }, take: 1 },
      patient: { select: { admissions: { select: CARE_TEAM_ADMISSION_SELECT } } },
    },
  });
  if (!summary) return null;
  return summaryAdmission(summary, summary.patient?.admissions ?? []);
}

/** Only the attending physician of the summary's admission may approve it. */
export async function assertAttending(prisma: PrismaService, summaryId: string, physicianId: string) {
  const admission = await loadSummaryAdmission(prisma, summaryId);
  if (!admission?.physicianId) {
    throw new ForbiddenException(
      'This admission has no attending physician, so its summary cannot be approved yet.',
    );
  }
  if (admission.physicianId !== physicianId) {
    throw new ForbiddenException('Only the attending physician can approve this summary.');
  }
}

/** Attending or consulting physicians of the summary's admission may edit it. */
export async function assertSummaryCareTeam(
  prisma: PrismaService,
  summaryId: string,
  physicianId: string,
) {
  if (!isOnCareTeam(await loadSummaryAdmission(prisma, summaryId), physicianId)) {
    throw new ForbiddenException('You are not on this patient’s care team for this admission.');
  }
}

/**
 * Consulting-only physicians may notify the attending after discharge that they
 * reviewed / endorse a day's draft. Attending keeps final approval for claims.
 */
export async function assertConsultingCanNotifyAttending(
  prisma: PrismaService,
  summaryId: string,
  physicianId: string,
) {
  const admission = await loadSummaryAdmission(prisma, summaryId);
  if (!admission) {
    throw new ForbiddenException('This summary has no admission to notify about.');
  }
  if (!admission.physicianId) {
    throw new BadRequestException(
      'This admission has no attending physician to notify yet.',
    );
  }
  if (isAttending(admission, physicianId)) {
    throw new BadRequestException(
      'You are the attending physician — approve the summary yourself instead of notifying.',
    );
  }
  if (!isConsultingOnly(admission, physicianId)) {
    throw new ForbiddenException(
      'Only a consulting physician on this admission can notify the attending.',
    );
  }
  if (!admission.dischargeDate) {
    throw new BadRequestException(
      'Notify the attending only after the patient is discharged.',
    );
  }
  return admission;
}

/** Generating a summary needs the physician on one of the patient's admissions. */
export async function assertPatientCareTeam(
  prisma: PrismaService,
  patientId: string,
  physicianId: string,
) {
  const count = await prisma.patientAdmission.count({
    where: {
      patientId,
      OR: [{ physicianId }, { additionalPhysicians: { some: { physicianId } } }],
    },
  });
  if (!count) throw new ForbiddenException('You are not on this patient’s care team.');
}
