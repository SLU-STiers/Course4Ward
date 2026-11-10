import { ValidationOptions, registerDecorator } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt ignores everything past 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_RULE_MESSAGE =
  `Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters, include at least one letter ` +
  'and one number, and not be one repeated character';

/** Whether `value` is long enough and not trivially guessable ("aaaaaaaa", "12345678"). */
export function isAcceptablePassword(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) return false;
  if (!/\p{L}/u.test(value) || !/\d/.test(value)) return false;
  return new Set(value).size >= 4;
}

export function IsStrongPassword(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isAcceptablePassword',
      target: object.constructor,
      propertyName,
      options: { message: PASSWORD_RULE_MESSAGE, ...options },
      validator: { validate: isAcceptablePassword },
    });
}
