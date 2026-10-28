// Server-only settings. Never imported by client components (no NEXT_PUBLIC_ prefix, so Next
// would not inline them into the browser bundle anyway).

export const ACCESS_COOKIE = '__Host-at';

export function apiUrl(): string {
  return process.env['API_INTERNAL_URL'] ?? 'http://localhost:4000';
}
