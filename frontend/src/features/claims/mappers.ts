/** Part of the claims dashboard — see index.tsx for the screen shell. */

import type { ClaimRecord } from '../../types';
import { calculateAge, computeAge, formatDateMedium, formatTimeMedium, toDateInputValue } from '../../lib/format';
import { triageForDisplay, triageLevelInfo, VITAL_FIELDS } from '../../lib/triage';
import { INSURANCE_LABEL, PATIENT_CLASS_LABEL, admissionStatus, daysInCare, fullName, initials, sexLabel, statusColor } from '../../lib/patient';

import type { CF4Patient, Cf4SummaryDraft, StayChart, SummarizationRequest } from './types';

function shown(value?: string | null): string {
  const text = value?.trim();
  return text ? text : '—';
}

/** Plain lines for the CF4. One fact per line, so nothing shares a baseline. */
function triageLine(admission: ClaimRecord['summary']['orders'][number]['admission'] | undefined): string {
  const triage = triageForDisplay(admission);
  const level = triageLevelInfo(triage.level);
  const lines: string[] = [];
  if (level) lines.push(`${level.name} (ESI ${level.level}). Seen ${level.target.toLowerCase()}.`);
  for (const field of VITAL_FIELDS) {
    if (field.key === 'time') continue;
    const value = triage[field.key];
    if (!value || value === '—') continue;
    const unit = 'unit' in field ? ` ${field.unit}` : '';
    lines.push(`${field.label}: ${value}${unit}`);
  }
  return lines.length ? lines.join('\n') : '—';
}

function chartFor(claim: ClaimRecord, doctor: string): StayChart {
  const patient = claim.summary.patient;
  const admission = claim.summary.orders[0]?.admission;
  const insurance = patient.insurance
    ? patient.insurance === 'OTHER'
      ? shown(patient.insuranceOther)
      : INSURANCE_LABEL[patient.insurance]
    : '—';
  const emergency = [patient.contactPersonName, patient.contactPersonNumber, patient.contactPersonAddress]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ');
  const ward = admission?.room?.ward?.name;
  const room = admission?.room?.number;
  const attending = admission?.physician
    ? `${admission.physician.firstName} ${admission.physician.lastName}`
    : doctor;

  return {
    dateOfBirth: patient.dateOfBirth ? formatDateMedium(patient.dateOfBirth) : '—',
    contactNumber: shown(patient.contactNumber),
    address: shown(patient.address),
    insurance,
    religion: shown(patient.religion),
    emergencyContact: emergency || '—',
    attending,
    location: [ward, room ? `Room ${room}` : ''].filter(Boolean).join(' · ') || '—',
    patientClass: admission?.patientClass ? PATIENT_CLASS_LABEL[admission.patientClass] : '—',
    triage: triageLine(admission),
    assessment: shown(admission?.initialAssessment),
  };
}

function uniqueShown(values: string[]): string {
  const seen = [...new Set(values.map((value) => value.trim()).filter((value) => value && value !== '—'))];
  return seen.length ? seen.join('; ') : '—';
}

/** One day of a stay's Course in the Ward: a PDF row and a preview section. */
export type CourseEntry = {
  dateLabel: string;
  text: string;
  /** The day's summary; absent for the whole-stay fallback entry. */
  requestId?: string;
  /** The physician orders this day's summary was written from. */
  orders: SummarizationRequest['orders'];
};

/** The entry's own date says which day it is, so a "Finished orders for …:" heading is dropped. */
const DAY_HEADING = /^\s*Finished orders for [^\n]*:\s*\n?/i;

/** One entry per approved day, oldest first; the whole stay as one entry when there are none. */
export function courseEntries(draft: Cf4SummaryDraft): CourseEntry[] {
  const days = draft.requests
    .map((request) => ({
      dateLabel: formatDateMedium(request.summaryDate),
      text: request.summaryText.replace(DAY_HEADING, '').trim(),
      requestId: request.id,
      orders: request.orders,
    }))
    .filter((entry) => entry.text);
  return days.length
    ? days
    : [{ dateLabel: draft.patient.coveragePeriod, text: draft.courseText, orders: [] }];
}

/**
 * One Course in the Ward for a stay. The PDF prints the model summary the
 * physician approved, not the raw orders and not a day-by-day order list.
 */
export function buildStayDraft(patient: CF4Patient, requests: SummarizationRequest[]): Cf4SummaryDraft {
  const ordered = [...requests].sort(
    (a, b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime(),
  );
  const first = ordered[0];
  const courseText = ordered
    .map((request) => request.summaryText.trim())
    .filter(Boolean)
    .join('\n\n');

  return {
    patient,
    requests: ordered,
    courseText: courseText || 'No physician-approved Course in the Ward is available for this stay.',
    chart: {
      dateOfBirth: first?.chart.dateOfBirth ?? '—',
      contactNumber: first?.chart.contactNumber ?? '—',
      address: first?.chart.address ?? '—',
      insurance: first?.chart.insurance ?? '—',
      religion: first?.chart.religion ?? '—',
      emergencyContact: first?.chart.emergencyContact ?? '—',
      attending: uniqueShown(ordered.map((request) => request.chart.attending)),
      location: uniqueShown(ordered.map((request) => request.chart.location)),
      patientClass: uniqueShown(ordered.map((request) => request.chart.patientClass)),
      triage: uniqueShown(ordered.map((request) => request.chart.triage)),
      assessment: uniqueShown(ordered.map((request) => request.chart.assessment)),
    },
  };
}

export function mapClaimToRequest(claim: ClaimRecord): SummarizationRequest {
  const patient = claim.summary.patient;
  const order = claim.summary.orders[0];
  const submittedAt = claim.requestedAt;
  const admissionDate = order?.admission.admissionDate ?? claim.summary.summaryDate;

  return {
    id: claim.id,
    submittedAt,
    summaryDate: claim.summary.summaryDate,
    admissionId: order?.admission.id ?? '',
    doctor: order ? `${order.orderedBy.firstName} ${order.orderedBy.lastName}` : 'Attending physician',
    date: formatDateMedium(submittedAt),
    time: formatTimeMedium(submittedAt),
    status: claim.status === 'CF4_GENERATED' || claim.status === 'VALIDATED' ? 'Approved' : 'Pending Review',
    patient: {
      name: fullName(patient),
      initials: initials(patient),
      patientId: patient.id,
      age: calculateAge(patient.dateOfBirth),
      gender: sexLabel(patient.gender, 'Not recorded'),
      admissionDate: formatDateMedium(admissionDate),
      dischargeDate: order?.admission.dischargeDate
        ? formatDateMedium(order.admission.dischargeDate)
        : 'Present',
    },
    summaryText: claim.summary.summaryContent,
    physicianApproved: claim.summary.status === 'APPROVED' && Boolean(claim.summary.approvedStatus),
    chart: chartFor(claim, order ? `${order.orderedBy.firstName} ${order.orderedBy.lastName}` : 'Attending physician'),
    triage: triageForDisplay(order?.admission),
    orders: claim.summary.orders.map((summaryOrder) => ({
      id: summaryOrder.id,
      content: summaryOrder.orderContent,
      dateCreated: summaryOrder.dateCreated,
      doctor: summaryOrder.orderedBy
        ? `${summaryOrder.orderedBy.firstName} ${summaryOrder.orderedBy.lastName}`
        : 'Attending physician',
      /* Nurse execution state — the timeline renders it via OrderStatusSummary. */
      status: summaryOrder.status,
      type: summaryOrder.type,
      nurseComment: summaryOrder.nurseComment,
      executedAt: summaryOrder.executedAt,
      executedBy: summaryOrder.executedBy,
    })),
  };
}
export function mapClaimToPatient(claim: ClaimRecord): CF4Patient {
  const patient = claim.summary.patient;
  const admission = claim.summary.orders[0]?.admission;
  const admissionDate = admission?.admissionDate ?? claim.summary.summaryDate;
  const dischargeDate = admission?.dischargeDate;
  const admissionDateRaw = toDateInputValue(new Date(admissionDate));
  const summaryDateRaw = toDateInputValue(new Date(claim.summary.summaryDate));
  const dischargeDateRaw = dischargeDate
    ? toDateInputValue(new Date(dischargeDate))
    : null;
  const status = admissionStatus(dischargeDate);

  return {
    id: claim.id,
    claimId: claim.id,
    claimIds: [claim.id],
    admissionId: admission?.id ?? '',
    name: fullName(patient),
    patientId: patient.id,
    gender: sexLabel(patient.gender),
    age: computeAge(patient.dateOfBirth),
    color: statusColor(status),
    admissionDate: formatDateMedium(admissionDate),
    admissionDateRaw,
    coverageEndDateRaw: dischargeDateRaw && dischargeDateRaw > summaryDateRaw
      ? dischargeDateRaw
      : summaryDateRaw,
    dischargeDateRaw,
    coveragePeriod: '',
    daysInCare: daysInCare(admissionDate, dischargeDate),
    status,
    missingDays: claim.stay?.missingDays ?? [],
    unrequestedDays: claim.stay?.unrequestedDays ?? [],
    unapprovedDays: claim.stay?.unapprovedDays ?? [],
    incompleteDays: claim.stay?.incompleteDays ?? [],
    approved:
      claim.summary.status === 'APPROVED' &&
      Boolean(claim.summary.approvedStatus) &&
      !claim.stay?.missingDays.length &&
      !claim.stay?.incompleteDays?.length &&
      !claim.stay?.unrequestedDays.length,
    cf4Generated: claim.status === 'CF4_GENERATED',
  };
}

/** A stay is one admission; two admissions of the same patient are two CF4s. */
export function stayKey(entry: { admissionId: string; patientId: string }): string {
  return entry.admissionId || entry.patientId;
}

/**
 * One row per stay (admission). Daily claims are folded into that row
 * (`claimIds`) so the same stay is not listed once per summary day.
 */
export function groupStayPatients(patients: CF4Patient[]): CF4Patient[] {
  const grouped = new Map<string, {
    patient: CF4Patient;
    admissions: Map<string, CF4Patient>;
  }>();

  for (const patient of patients) {
    const key = stayKey(patient);
    const existing = grouped.get(key);
    if (existing) {
      existing.patient.claimIds.push(patient.claimId);
      existing.patient.approved = existing.patient.approved && patient.approved;
      existing.patient.cf4Generated = existing.patient.cf4Generated && patient.cf4Generated;
      if (patient.admissionDateRaw < existing.patient.admissionDateRaw) {
        existing.patient.admissionDate = patient.admissionDate;
        existing.patient.admissionDateRaw = patient.admissionDateRaw;
      }
      if (patient.coverageEndDateRaw > existing.patient.coverageEndDateRaw) {
        existing.patient.coverageEndDateRaw = patient.coverageEndDateRaw;
      }
      if (patient.status === 'admitted') {
        existing.patient.status = 'admitted';
        existing.patient.color = patient.color;
        existing.patient.dischargeDateRaw = null;
      } else if (
        existing.patient.status === 'discharged' &&
        patient.dischargeDateRaw &&
        (!existing.patient.dischargeDateRaw ||
          patient.dischargeDateRaw > existing.patient.dischargeDateRaw)
      ) {
        existing.patient.dischargeDateRaw = patient.dischargeDateRaw;
      }
      const admissionKey = patient.admissionId || patient.admissionDateRaw;
      if (!existing.admissions.has(admissionKey)) {
        existing.admissions.set(admissionKey, patient);
      }
    } else {
      grouped.set(key, {
        patient: {
          ...patient,
          id: key,
          claimIds: [patient.claimId],
        },
        admissions: new Map([[patient.admissionId || patient.admissionDateRaw, patient]]),
      });
    }
  }

  return [...grouped.values()]
    .map(({ patient, admissions }) => {
      const status = patient.status;
      const start = patient.admissionDate;
      const end = formatDateMedium(new Date(`${patient.coverageEndDateRaw}T12:00:00`));
      patient.coveragePeriod = `${start}${patient.admissionDateRaw === patient.coverageEndDateRaw ? '' : ` – ${end}`}${status === 'admitted' ? ' (Present)' : ' (Discharged)'}`;
      patient.daysInCare = [...admissions.values()].reduce(
        (total, admission) => total + admission.daysInCare,
        0,
      );
      return patient;
    });
}

/** Stays ready for a CF4: every day physician-approved, CF4 not yet generated. */
export function groupApprovedPatients(patients: CF4Patient[]): CF4Patient[] {
  return groupStayPatients(patients).filter((patient) => patient.approved && !patient.cf4Generated);
}

/** Stays whose CF4 has already been generated for every claim. */
export function groupGeneratedPatients(patients: CF4Patient[]): CF4Patient[] {
  return groupStayPatients(patients).filter((patient) => patient.cf4Generated);
}
