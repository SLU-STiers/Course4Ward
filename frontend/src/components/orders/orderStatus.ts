import type { StatusValue } from '../ui';
import type { OrderStatus, PhysicianOrder } from '../../types';

/** Order execution states in workflow order, with their label and badge tone. */
export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string; badge: StatusValue }[] = [
  { value: 'TO_ACCOMPLISH', label: 'To accomplish', badge: 'pending' },
  { value: 'ONGOING', label: 'Ongoing', badge: 'in-progress' },
  { value: 'FINISHED', label: 'Finished', badge: 'completed' },
];

/**
 * Exactly what `OrderStatusSummary` renders: the nurse's execution state of an
 * order. Screens that carry these fields without the rest of a `PhysicianOrder`
 * — the claims timeline's mapped orders, for instance — can still show the same
 * status badge, order-type tag, executor and note.
 */
export type OrderExecutionState = Pick<
  PhysicianOrder,
  'status' | 'type' | 'nurseComment' | 'executedAt' | 'executedBy'
>;
