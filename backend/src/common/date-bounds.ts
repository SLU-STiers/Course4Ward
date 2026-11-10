const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lower bound of a date filter. A date-only value (`2026-11-10`) means the
 * start of that whole UTC day; a full ISO-8601 instant is used as-is.
 */
export function startOfDateBound(value: string): Date {
  return DATE_ONLY.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
}

/**
 * Upper bound of a date filter. A date-only value means the *end* of that UTC
 * day, so `from=2026-11-10&to=2026-11-10` covers the whole day rather than
 * nothing; a full ISO-8601 instant is used as-is.
 */
export function endOfDateBound(value: string): Date {
  return DATE_ONLY.test(value) ? new Date(`${value}T23:59:59.999Z`) : new Date(value);
}
