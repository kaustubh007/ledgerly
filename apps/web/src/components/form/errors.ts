import type { FieldError } from 'react-hook-form';

/**
 * Error codes → message keys. Client-side zod issues and server `userErrors` both end up here,
 * keyed by stable codes, so no English text from the server is ever shown in German.
 */
export function errorKey(code: string): string {
  return `errors.${code}`;
}

/** react-hook-form's zod resolver puts the zod issue code in `type`. */
export function fieldErrorCode(error: FieldError | undefined, field: string): string | undefined {
  if (!error) return undefined;
  if (error.type === 'invalid_format' && field === 'email') return 'INVALID_EMAIL';
  return typeof error.type === 'string' ? error.type.toUpperCase() : 'generic';
}
