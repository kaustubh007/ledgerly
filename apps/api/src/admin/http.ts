import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithContext, type RequestContext } from '../context/request-context.ts';
import type { Deps } from '../deps.ts';
import { STAFF_SESSION_COOKIE } from './staff/cookies.ts';
import { authenticateStaff } from './staff/staff-auth.service.ts';

/**
 * The admin console's request context (ADR-0004): a staff session or nothing. It never reads the
 * tenant cookie, so a tenant session cannot authenticate an admin request, and the tenant
 * middleware never reads this one.
 */
export function adminRequestContext(deps: Deps) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token: unknown = (req.cookies as Record<string, unknown> | undefined)?.[
      STAFF_SESSION_COOKIE
    ];
    const staff = await authenticateStaff(deps, typeof token === 'string' ? token : undefined);
    const context: RequestContext = {
      requestId: req.get('x-request-id') ?? randomUUID(),
      ip: req.ip ?? '',
      userAgent: req.get('user-agent'),
      ...(staff ? { staff } : {}),
    };
    runWithContext(context, next);
  };
}
