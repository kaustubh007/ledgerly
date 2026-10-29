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
  readonly tenant?: { readonly orgId: string; readonly role: Role };
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
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
  const base = storage.getStore() ?? { requestId: 'internal', ip: '', userAgent: undefined };
  return storage.run({ ...base, tenant: { orgId, role } }, fn);
}
