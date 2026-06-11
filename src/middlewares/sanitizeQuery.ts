/**
 * Coerces a query-string value to a plain string, defending against NoSQL operator
 * injection (e.g. ?field[$ne]=x, ?field[$regex]=.*).
 *
 * Express's query parser turns nested brackets into objects, which Mongoose passes
 * straight to MongoDB. Any user-controlled filter value must go through this helper
 * before being used as an equality match.
 */
export function asScalarString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}
