/**
 * Shared date / time / age helpers.
 *
 * Every role dashboard used to re-implement these locally — and with subtly
 * different locales (`en-GB` vs `en-US`) — so the same concept could render
 * two ways depending on the screen. They now live here once.
 *
 * Each *display* formatter is named after the exact output it produces, so
 * moving a call site to this module never changes what the user sees.
 */

/** `YYYY-MM-DD` in local time — safe for `<input type="date">` and date math. */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today's local calendar date as `YYYY-MM-DD`. */
export function todayValue(): string {
  return toDateInputValue(new Date());
}

/** Local calendar date `days` days before today, as `YYYY-MM-DD`. */
export function daysAgoValue(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toDateInputValue(date);
}

/** `YYYY-MM-DD` for any timestamp, or `''` when unparseable. */
export function toDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : toDateInputValue(date);
}

/** Whole years between `dateOfBirth` and today, or `null` when invalid. */
export function computeAge(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age < 0 ? null : age;
}

/** Age in whole years, falling back to `0` for missing / invalid input. */
export function calculateAge(dateOfBirth: string | null): number {
  return computeAge(dateOfBirth) ?? 0;
}

// --- Display formats (one per distinct on-screen rendering) ---

/** `15/04/2026` — short numeric en-GB. */
export function formatDateNumeric(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-GB');
}

/** `15 Apr 2026` — en-GB with an abbreviated month. */
export function formatDateShort(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** `Apr 15, 2026` — en-US with an abbreviated month. */
export function formatDateMedium(value: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

/** `April 15, 2026` — en-US with the full month, for order-day headings. */
export function formatDateLong(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * `April 15, 2026` from a `YYYY-MM-DD` key, read as a *local* calendar date.
 * (`new Date('2026-04-15')` would parse as UTC and can shift a day.)
 */
export function formatDateLongFromKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return formatDateLong(new Date(year, (month || 1) - 1, day || 1));
}

/** `08:12 AM` — en-US 24-hour-free clock. */
export function formatTimeMedium(value: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/** `08:12` — the browser locale's short clock, used for order timestamps. */
export function formatTimeClock(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** The browser locale's default time rendering, used in activity logs. */
export function formatTimeLocale(value: string | Date): string {
  return new Date(value).toLocaleTimeString();
}
