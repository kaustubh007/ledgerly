import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from '@ledgerly/domain';

/**
 * Who is calling, set once per request by the HTTP layer and readable anywhere below it without
 * being passed around: the tenant guard, the logger and the resolvers all read it from here.
 */
export interface RequestContext {
  readonly requestId: string;
  readonly ip: string;
  readonly userAgent: string | undefined;
  /** Set when a valid access token for an active session was presented. */
  readonly user?: { readonly userId: string; readonly sessionId: string };
  /** Set when `x-org` names an organisation the user belongs to. */
  readonly tenant?: { readonly orgId: string; readonly role: Role; readonly suspended?: boolean };
  /** Admin console requests only (ADR-0004): the signed-in staff member. Never with `user`. */
  readonly staff?: {
    readonly staffId: string;
    readonly sessionId: string;
    readonly role: StaffRole;
  };
  /**
   * Set only inside `runAsPlatform()` (admin module). Lets the tenant guard admit the reads the
   * admin module registered, one named organisation at a time. Never together with `tenant`.
   */
  readonly platform?: { readonly staffId: string; readonly reason: string | null };
}

export type StaffRole = 'SUPPORT' | 'OPS';

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}

/** The platform scope, if `runAsPlatform()` is active (and no tenant is). */
export function currentPlatform(): RequestContext['platform'] {
  const store = storage.getStore();
  return store?.tenant ? undefined : store?.platform;
}

/** Org id for the tenant guard. Undefined outside a tenant-scoped request. */
export function currentOrgId(): string | undefined {
  return storage.getStore()?.tenant?.orgId;
}

/**
 * Runs `fn` as a member of `orgId`. For flows where the organisation is established inside the
 * request rather than by the `x-org` header: sign-up (the org is created in this request) and
 * accepting an invitation. Never pass an org id taken from client input.
 */
export function runInTenant<T>(orgId: string, role: Role, fn: () => T): T {
  // Only the caller's identity carries over: never a platform scope or a staff session.
  const store = storage.getStore();
  const context: RequestContext = {
    requestId: store?.requestId ?? 'internal',
    ip: store?.ip ?? '',
    userAgent: store?.userAgent,
    ...(store?.user ? { user: store.user } : {}),
    tenant: { orgId, role },
  };
  return storage.run(context, fn);
}
