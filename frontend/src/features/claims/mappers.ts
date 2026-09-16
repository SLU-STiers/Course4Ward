/** Part of the claims dashboard — see index.tsx for the screen shell. */

import type { ClaimRecord } from '../../types';
import { calculateAge, computeAge, formatDateMedium, formatTimeMedium, toDateInputValue } from '../../lib/format';
import { admissionStatus, daysInCare, fullName, initials, statusColor } from '../../lib/patient';

import type { CF4Patient, SummarizationRequest } from './types';

export function mapClaimToRequest(claim: ClaimRecord): SummarizationRequest {
  const patient = claim.summary.patient;
  const order = claim.summary.orders[0];
  const submittedAt = claim.requestedAt;
  const admissionDate = order?.admission.admissionDate ?? claim.summary.summaryDate;

  return {
    id: claim.id,
    doctor: order ? `${order.orderedBy.firstName} ${order.orderedBy.lastName}` : 'Attending physician',
    date: formatDateMedium(submittedAt),
    time: formatTimeMedium(submittedAt),
    status: claim.status === 'CF4_GENERATED' || claim.status === 'VALIDATED' ? 'Approved' : 'Pending Review',
    patient: {
      name: fullName(patient),
      initials: initials(patient),
      patientId: patient.id,
      age: calculateAge(patient.dateOfBirth),
      gender: patient.gender ?? 'Not recorded',
      admissionDate: formatDateMedium(admissionDate),
    },
    summaryText: claim.summary.summaryContent,
    orders: claim.summary.orders.map((summaryOrder) => ({
      content: summaryOrder.orderContent,
      dateCreated: summaryOrder.dateCreated,
      doctor: summaryOrder.orderedBy
        ? `${summaryOrder.orderedBy.firstName} ${summaryOrder.orderedBy.lastName}`
        : 'Attending physician',
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
    name: fullName(patient),
    patientId: patient.id,
    gender: patient.gender ?? '—',
    age: computeAge(patient.dateOfBirth),
    color: statusColor(status),
    admissionDate: formatDateMedium(admissionDate),
    admissionDateRaw: toDateInputValue(new Date(admissionDate)),
    daysInCare: daysInCare(admissionDate, dischargeDate),
    status,
    selected: false,
  };
}
