/** Mirrors the server's password rule (backend/src/auth/password-policy.ts). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_RULE_HINT =
  `${PASSWORD_MIN_LENGTH}+ characters with at least one letter and one number.`;

/** Why `value` would be refused as a password, or null when it is acceptable. */
export function passwordProblem(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (value.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (!/\p{L}/u.test(value) || !/\d/.test(value)) return 'Include at least one letter and one number.';
  if (new Set(value).size < 4) return 'Avoid repeating the same few characters.';
  return null;
}

/** Staff and patient names: letters, spaces, hyphens, apostrophes and periods. */
export const PERSON_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'\u2019-]*$/u;
