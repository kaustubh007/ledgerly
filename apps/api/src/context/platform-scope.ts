import { currentContext, runWithContext } from './request-context.ts';

/**
 * Runs `fn` in the platform scope (ADR-0004): a staff member reading across tenants for support.
 * The tenant guard then admits only the reads the admin module registered
 * (`allowPlatformReads`), and only when each one names a single organisation explicitly.
 *
 * Importable only from `src/admin/` (dependency-cruiser). Every use is audited by the caller.
 */
export function runAsPlatform<T>(
  scope: { readonly staffId: string; readonly reason: string | null },
  fn: () => T,
): T {
  const base = currentContext();
  if (base?.tenant) throw new Error('runAsPlatform() cannot be entered from a tenant context.');
  if (base?.user) throw new Error('runAsPlatform() cannot be entered by a tenant user.');
  return runWithContext(
    { ...(base ?? { requestId: 'internal', ip: '', userAgent: undefined }), platform: scope },
    fn,
  );
}
