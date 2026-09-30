/**
 * Shared patient helpers.
 *
 * The dashboards each mapped patient records into their own view models and
 * re-derived the same things along the way — full name, initials, the
 * admitted/discharged status, length of stay and its accent colour. Those
 * primitives live here once so the mappers only describe what is *different*
 * about each view.
 */

import type { InsuranceType, PatientClass, Sex } from '../types';

export type AdmissionStatus = 'admitted' | 'discharged';

/** Display name of each patient class. */
export const PATIENT_CLASS_LABEL: Record<PatientClass, string> = {
  EMERGENCY: 'Emergency',
  OUTPATIENT: 'Outpatient',
  OBSERVATION: 'Observation',
  INPATIENT: 'Admitted',
};

/** Display name of each sex, in the order the registration form lists them. */
export const SEX_LABEL: Record<Sex, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

export const INSURANCE_LABEL: Record<InsuranceType, string> = {
  PHILHEALTH: 'PhilHealth',
  HMO: 'HMO',
  PRIVATE: 'Private',
  NONE: 'None',
  OTHER: 'Other',
};

/** Display name of a patient's sex, or `fallback` when it was never recorded. */
export function sexLabel(sex: Sex | null | undefined, fallback = '—'): string {
  return sex ? SEX_LABEL[sex] ?? fallback : fallback;
}

/**
 * Observation is a short stay to decide between admitting and sending home;
 * past this many hours the physician should make that call.
 */
export const OBSERVATION_LIMIT_HOURS = 24;

/** Whole hours since `since` (0 when missing or in the future). */
export function hoursSince(since?: string | null): number {
  if (!since) return 0;
  const ms = Date.now() - new Date(since).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 3_600_000) : 0;
}

interface NameParts {
  firstName: string;
  lastName: string;
}

/** `First Last`. */
export function fullName(person: NameParts): string {
  return `${person.firstName} ${person.lastName}`;
}

/** `FL` — uppercase initials of the first and last name. */
export function initials(person: NameParts): string {
  return `${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`.toUpperCase();
}

/** A patient is discharged once a discharge date exists, otherwise admitted. */
export function admissionStatus(dischargeDate?: string | null): AdmissionStatus {
  return dischargeDate ? 'discharged' : 'admitted';
}

/**
 * Whole days from admission to discharge (or today when still admitted),
 * counted inclusively and floored at 1.
 */
export function daysInCare(admissionDate?: string | null, dischargeDate?: string | null): number {
  const start = admissionDate ? new Date(admissionDate) : new Date();
  const end = dischargeDate ? new Date(dischargeDate) : new Date();
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, Number.isFinite(days) ? days : 1);
}

/** Accent colour for a patient row's status dot. */
export function statusColor(status: AdmissionStatus): string {
  return status === 'admitted' ? '#22c55e' : '#ef4444';
}
