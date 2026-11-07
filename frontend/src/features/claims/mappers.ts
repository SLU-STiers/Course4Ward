/** Part of the claims dashboard — see index.tsx for the screen shell. */

import type { ClaimRecord } from '../../types';
import { calculateAge, computeAge, formatDateMedium, formatTimeMedium, toDateInputValue } from '../../lib/format';
import { triageForDisplay } from '../../lib/triage';
import { admissionStatus, daysInCare, fullName, initials, sexLabel, statusColor } from '../../lib/patient';

import type { CF4Patient, SummarizationRequest } from './types';

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
    },
    summaryText: claim.summary.summaryContent,
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
    approved: claim.summary.status === 'APPROVED' && Boolean(claim.summary.approvedStatus),
  };
}

/** One export row represents a patient and includes all their daily claims. */
export function groupApprovedPatients(patients: CF4Patient[]): CF4Patient[] {
  const grouped = new Map<string, {
    patient: CF4Patient;
    admissions: Map<string, CF4Patient>;
  }>();

  for (const patient of patients) {
    const key = patient.patientId;
    const existing = grouped.get(key);
    if (existing) {
      existing.patient.claimIds.push(patient.claimId);
      existing.patient.approved = existing.patient.approved && patient.approved;
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
    })
    .filter((patient) => patient.approved);
}
