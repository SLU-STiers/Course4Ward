/** Part of the claims dashboard — see index.tsx for the screen shell. */

import type { ClaimRecord } from '../../types';
import { calculateAge, formatDateMedium, formatTimeMedium } from '../../lib/format';
import { admissionStatus, fullName, initials } from '../../lib/patient';

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
      doctor: `${summaryOrder.orderedBy.firstName} ${summaryOrder.orderedBy.lastName}`,
    })),
  };
}
export function mapClaimToPatient(claim: ClaimRecord): CF4Patient {
  const patient = claim.summary.patient;
  const admissionDate = claim.summary.orders[0]?.admission.admissionDate ?? claim.summary.summaryDate;
  const dischargeDate = claim.summary.orders[0]?.admission.dischargeDate;

  return {
    id: claim.id,
    claimId: claim.id,
    name: fullName(patient),
    patientId: patient.id,
    admissionDate: formatDateMedium(admissionDate),
    color: '#22c55e',
    status: admissionStatus(dischargeDate),
    selected: false,
  };
}
