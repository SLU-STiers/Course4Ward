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
    admissionDateRaw: toDateInputValue(new Date(admissionDate)),
    daysInCare: daysInCare(admissionDate, dischargeDate),
    status,
    approved: claim.summary.status === 'APPROVED' && Boolean(claim.summary.approvedStatus),
  };
}

/** One export row represents one admission and includes every daily claim. */
export function groupApprovedPatients(patients: CF4Patient[]): CF4Patient[] {
  const grouped = new Map<string, CF4Patient>();

  for (const patient of patients) {
    const key = patient.admissionId
      ? `${patient.patientId}:${patient.admissionId}`
      : `${patient.patientId}:${patient.admissionDateRaw}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.claimIds.push(patient.claimId);
      existing.approved = existing.approved && patient.approved;
    } else {
      grouped.set(key, {
        ...patient,
        id: key,
        claimIds: [patient.claimId],
      });
    }
  }

  return [...grouped.values()].filter((patient) => patient.approved);
}
