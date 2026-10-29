import { Router, type Request, type Response } from 'express';
import { currentContext } from '../context/request-context.ts';
import type { Deps } from '../deps.ts';
import {
  refresh,
  revokeSessionByRefreshToken,
  revokeSession,
} from '../features/identity/auth.service.ts';
import {
  clearSessionCookies,
  REFRESH_COOKIE,
  setSessionCookies,
} from '../features/identity/cookies.ts';

/** Header the browser must send; a cross-site form cannot set it, and a cross-origin fetch
 * that sets it triggers a CORS preflight we never approve. Defence in depth on top of SameSite. */
export const CSRF_HEADER = 'x-ledgerly-csrf';

function cookie(req: Request, name: string): string | undefined {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** REST, not GraphQL: the refresh cookie is scoped to this path and must never ride along on
 * every GraphQL request (ADR-0003). Mounted at /graphql/auth, inside the API's route (ADR-0001). */
export function authRoutes(deps: Deps): Router {
  const router = Router();

  router.use((req: Request, res: Response, next) => {
    if (req.method !== 'POST' || req.get(CSRF_HEADER) === undefined) {
      res.status(400).json({ error: 'BAD_REQUEST' });
      return;
    }
    next();
  });

  router.post('/refresh', async (req, res) => {
    const token = cookie(req, REFRESH_COOKIE);
    const ctx = currentContext();
    const outcome = token
      ? await refresh(deps, token, { ip: ctx?.ip ?? '', userAgent: ctx?.userAgent })
      : ({ kind: 'invalid' } as const);
    if (outcome.kind !== 'ok') {
      clearSessionCookies(res);
      res
        .status(401)
        .json({ error: outcome.kind === 'reuse' ? 'SESSION_REVOKED' : 'UNAUTHENTICATED' });
      return;
    }
    setSessionCookies(res, outcome.access, outcome.refresh);
    res.status(204).end();
  });

  router.post('/logout', async (req, res) => {
    const token = cookie(req, REFRESH_COOKIE);
    if (token) await revokeSessionByRefreshToken(deps, token);
    const user = currentContext()?.user;
    if (user) await revokeSession(deps, user.userId, user.sessionId, 'LOGOUT');
    clearSessionCookies(res);
    res.status(204).end();
  });

  return router;
}
