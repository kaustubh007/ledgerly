// The allowlist behind the platform scope (ADR-0004). The admin module registers, per tenant
// model, the read operations it needs; everything else still throws under `runAsPlatform()`.
// Only reads: every admin command writes global models (organisations, sessions), never tenant
// data. Registration is importable only from `src/admin/` (dependency-cruiser).

export type PlatformRead = 'find' | 'findOne' | 'countDocuments' | 'distinct' | 'aggregate';

const registry = new Map<string, Set<PlatformRead>>();

export function allowPlatformReads(model: string, operations: readonly PlatformRead[]): void {
  const allowed = registry.get(model) ?? new Set<PlatformRead>();
  for (const operation of operations) allowed.add(operation);
  registry.set(model, allowed);
}

export function isPlatformReadAllowed(model: string, operation: string): boolean {
  return registry.get(model)?.has(operation as PlatformRead) ?? false;
}
