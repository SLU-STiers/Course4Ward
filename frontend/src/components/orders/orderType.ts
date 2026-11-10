import type { OrderType } from '../../types';

/**
 * Kinds of physician order. OBSERVATION places an emergency patient or
 * outpatient under observation, ADMISSION admits a non-inpatient to the ward
 * and DISCHARGE sends the patient home -- each carried out by the nurse, at
 * most once per admission. TRANSFER moves an inpatient to another room (any
 * ward) when the nurse finishes it; only the attending physician orders it.
 * Every other order is GENERAL (`DEFAULT` on the API).
 */
export const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'DEFAULT', label: 'General' },
  { value: 'OBSERVATION', label: 'Observation' },
  { value: 'ADMISSION', label: 'Admission' },
  { value: 'DISCHARGE', label: 'Discharge' },
  { value: 'TRANSFER', label: 'Transfer' },
];

export function orderTypeLabel(type: OrderType | undefined): string {
  return ORDER_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? 'General';
}
