/** The sign-in page in the locale of `pathname`, coming back to `pathname` afterwards. */
export function signInPath(pathname: string): string {
  const locale = /^\/([a-z]{2})(\/|$)/.exec(pathname)?.[1] ?? 'en';
  return `/${locale}/sign-in?next=${encodeURIComponent(pathname)}`;
}

/** Only same-site paths are followed after sign-in (no open redirect via `?next=`). */
export function safeNext(next: string | null | undefined, fallback: string): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
    ? next
    : fallback;
}
