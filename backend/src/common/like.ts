/**
 * Makes user-typed search text literal inside a SQL LIKE / ILIKE pattern.
 *
 * Prisma's `contains` / `string_contains` filters and our raw `ILIKE`
 * clauses both pass the text into a LIKE pattern without escaping it, so a
 * search for `%` or `_` would otherwise act as a wildcard and match every
 * row. Backslash is PostgreSQL's default LIKE escape character.
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}
