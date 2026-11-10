import type { OrderType } from '../../types';

/**
 * Kinds of physician order a physician can write. DISCHARGE sends the patient
 * home -- carried out by the nurse, at most once per admission. TRANSFER moves
 * an inpatient to another room (any ward) when the nurse finishes it; only the
 * attending physician orders it. Every other order is GENERAL (`DEFAULT` on the API).
 */
export const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'DEFAULT', label: 'General' },
  { value: 'DISCHARGE', label: 'Discharge' },
  { value: 'TRANSFER', label: 'Transfer' },
];

/** Retired kinds: no longer written, but older orders still carry them. */
const LEGACY_ORDER_TYPE_LABELS: Partial<Record<OrderType, string>> = {
  OBSERVATION: 'Observation',
  ADMISSION: 'Admission',
};

export function orderTypeLabel(type: OrderType | undefined): string {
  return (
    ORDER_TYPE_OPTIONS.find((option) => option.value === type)?.label ??
    (type && LEGACY_ORDER_TYPE_LABELS[type]) ??
    'General'
  );
}
