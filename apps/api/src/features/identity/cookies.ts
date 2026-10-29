import type { CookieOptions, Response } from 'express';
import { ACCESS_TOKEN_TTL_SECONDS } from './tokens.ts';

// ADR-0001/0003. `__Host-` requires Secure, Path=/ and no Domain: the cookie can only ever be
// set by, and sent to, exactly this origin. The refresh cookie needs a narrower Path, which
// `__Host-` forbids, so it uses `__Secure-` (Secure, and still no Domain = host-only).
export const ACCESS_COOKIE = '__Host-at';
export const REFRESH_COOKIE = '__Secure-rt';
/** Under /graphql so CloudFront already routes it to the API (ADR-0001) with no new behaviour. */
export const AUTH_PATH = '/graphql/auth';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const base: CookieOptions = { httpOnly: true, secure: true };

export function setSessionCookies(res: Response, access: string, refresh: string): void {
  res.cookie(ACCESS_COOKIE, access, {
    ...base,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  // Strict: the refresh call is always a same-site fetch, never a navigation from elsewhere.
  res.cookie(REFRESH_COOKIE, refresh, {
    ...base,
    sameSite: 'strict',
    path: AUTH_PATH,
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...base, sameSite: 'lax', path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, sameSite: 'strict', path: AUTH_PATH });
}
