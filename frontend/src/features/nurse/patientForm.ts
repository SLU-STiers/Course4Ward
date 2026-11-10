/** Part of the nurse dashboard — field rules shared by the Add Patient form and the Edit Details dialog. */

import { toDateInputValue, todayValue } from '../../lib/format';

export const MAX_AGE = 130;
export const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'\u2019-]*$/u;
export const PHONE_PATTERN = /^\d{11}$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const sanitizeName = (value: string) => value.replace(/[^\p{L}\p{M} .'\u2019-]/gu, '');
export const sanitizePhoneNumber = (value: string) => value.replace(/\D/g, '').slice(0, 11);

/** How the physician gave an order the nurse enters for them; '' = written / signed order. */
export type OrderChannel = '' | 'VERBAL' | 'CALL' | 'SMS' | 'OTHER';

export const ORDER_CHANNELS: [OrderChannel, string][] = [
  ['', 'Written / signed order'],
  ['VERBAL', 'Verbal'],
  ['CALL', 'Phone call'],
  ['SMS', 'SMS'],
  ['OTHER', 'Other'],
];

/** Religions common in the Philippines; anything else goes under "Others". */
export const RELIGIONS = [
  'Roman Catholic',
  'Islam',
  'Iglesia ni Cristo',
  'Born Again Christian',
  'Protestant',
  'Aglipayan (Philippine Independent Church)',
  'Seventh-day Adventist',
  "Jehovah's Witness",
  'Latter-day Saints (Mormon)',
  'Buddhism',
  'None',
];
/** Religion dropdown value that reveals the "please specify" input. */
export const RELIGION_OTHER = 'OTHER';

/** Earliest date of birth the forms accept: MAX_AGE years ago today. */
export const oldestBirthDate = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - MAX_AGE);
  return toDateInputValue(date);
};

/** The message to show under a Date of Birth field, or null when the value is valid. */
export function dateOfBirthError(value: string): string | null {
  if (!value) return 'Date of birth is required.';
  if (!DATE_PATTERN.test(value) || Number.isNaN(new Date(value).getTime())) {
    return 'Enter a valid date of birth.';
  }
  if (value > todayValue()) return 'Date of birth cannot be in the future.';
  if (value < oldestBirthDate()) return `Date of birth cannot be more than ${MAX_AGE} years ago.`;
  return null;
}
