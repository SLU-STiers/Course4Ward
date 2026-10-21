/**
 * The backend's own error message (NestJS `message`, a string or a list of
 * validation messages), or `fallback` when the request never got an answer.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' && message ? message : fallback;
}
