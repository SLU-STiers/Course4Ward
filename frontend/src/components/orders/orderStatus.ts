import type { StatusValue } from '../ui';
import type { OrderStatus } from '../../types';

/** Order execution states in workflow order, with their label and badge tone. */
export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string; badge: StatusValue }[] = [
  { value: 'TO_ACCOMPLISH', label: 'To accomplish', badge: 'pending' },
  { value: 'ONGOING', label: 'Ongoing', badge: 'in-progress' },
  { value: 'FINISHED', label: 'Finished', badge: 'completed' },
];
