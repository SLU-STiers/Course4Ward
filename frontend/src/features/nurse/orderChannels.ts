/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import type { CommunicationChannel } from '../../types';

/**
 * The four ways a doctor's order reaches the ward. The backend enum also has
 * CALL; the form deliberately mirrors the paper CF4 intake sheet, which only
 * asks these four.
 */
export const ORDER_CHANNELS: Array<{ value: CommunicationChannel; label: string }> = [
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'VERBAL', label: 'Verbal' },
  { value: 'OTHER', label: 'Others' },
];

/** Display wording for a stored channel, shared by the dialog and the orders timeline. */
export function channelLabel(channel?: CommunicationChannel | null): string | null {
  if (!channel) return null;
  if (channel === 'CALL') return 'Call';
  return ORDER_CHANNELS.find((option) => option.value === channel)?.label ?? channel;
}
