/**
 * Shared patient helpers.
 *
 * The dashboards each mapped patient records into their own view models and
 * re-derived the same things along the way — full name, initials, the
 * admitted/discharged status, length of stay and its accent colour. Those
 * primitives live here once so the mappers only describe what is *different*
 * about each view.
 */

export type AdmissionStatus = 'admitted' | 'discharged';

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
