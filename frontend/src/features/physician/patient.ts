/** Part of the physician dashboard — see index.tsx for the screen shell. */

import type { Patient } from '../../types';
import { computeAge, formatDateNumeric, toDateInputValue } from '../../lib/format';
import { admissionStatus, daysInCare, fullName, statusColor } from '../../lib/patient';

import type { DashboardPatient } from './types';

export function mapPatient(patient: Patient): DashboardPatient {
  const currentAdmission = patient.admissions?.[0];
  const admissionDate = patient.admissionDate ?? currentAdmission?.admissionDate ?? "";
  const dischargeDate = patient.dischargeDate || currentAdmission?.dischargeDate || null;
  const status = admissionStatus(dischargeDate);
  return {
    id: patient.id,
    name: fullName(patient),
    patientId: patient.id,
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth ?? null,
    age: computeAge(patient.dateOfBirth),
    admissionDate: admissionDate ? formatDateNumeric(admissionDate) : "—",
    admissionDateRaw: admissionDate ? toDateInputValue(new Date(admissionDate)) : "",
    daysInCare: daysInCare(admissionDate, currentAdmission?.dischargeDate),
    color: statusColor(status),
    status,
    admissions: patient.admissions,
  };
}
export const INITIAL_TODOS = [
  "Review newly admitted patients",
  "Update patient diagnoses",
  "Check lab/test results",
  "Monitor critical patients",
  "Approve discharge requests",
  "Review pending CF4 forms",
  "Verify AI-generated summaries",
  "Complete missing CF4 details",
  "Validate records (BAG check)",
];
