/** Where to go after signing in: a same-site path only, never `//evil.example`. */
export function safeNext(value: string | null | undefined, fallback = '/organizations'): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
