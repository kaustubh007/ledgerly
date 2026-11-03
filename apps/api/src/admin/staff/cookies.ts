import type { CookieOptions, Response } from 'express';
import { MFA_CHALLENGE_TTL_MS, STAFF_SESSION_ABSOLUTE_MS } from './staff-auth.service.ts';

// The admin console's own cookies (ADR-0004). In production they belong to the admin origin, so
// they can never meet the tenant app's `__Host-at`. Strict: the console never needs a cookie on
// a cross-site navigation.
export const STAFF_SESSION_COOKIE = '__Host-adm';
export const MFA_CHALLENGE_COOKIE = '__Host-adm-mfa';

const base: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/' };

export function setChallengeCookie(res: Response, token: string): void {
  res.cookie(MFA_CHALLENGE_COOKIE, token, { ...base, maxAge: MFA_CHALLENGE_TTL_MS });
}

export function setSessionCookie(res: Response, token: string): void {
  res.clearCookie(MFA_CHALLENGE_COOKIE, base);
  res.cookie(STAFF_SESSION_COOKIE, token, { ...base, maxAge: STAFF_SESSION_ABSOLUTE_MS });
}

export function clearStaffCookies(res: Response): void {
  res.clearCookie(MFA_CHALLENGE_COOKIE, base);
  res.clearCookie(STAFF_SESSION_COOKIE, base);
}
