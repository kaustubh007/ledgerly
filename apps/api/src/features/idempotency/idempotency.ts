import { createHash } from 'node:crypto';
import mongoose, { Schema } from 'mongoose';
import type { UserError } from '@ledgerly/validation';
import { inTransaction, isDuplicateKeyError } from '../../data/connection.ts';
import { tenantGuard, tenantOrgId } from '../../data/tenant-guard.ts';

// ADR-0002: a state-changing mutation carries a client-generated key. The first request with a
// key runs and its outcome is stored in the same transaction as its writes; any replay returns
// the stored outcome instead of running again.

/** What is stored and replayed: the id of what was changed, or the refusal. */
export type Outcome =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly userErrors: readonly UserError[] };

const idempotencyKeySchema = new Schema(
  {
    orgId: tenantOrgId,
    key: { type: String, required: true },
    operation: { type: String, required: true },
    requestHash: { type: String, required: true },
    outcome: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
idempotencyKeySchema.plugin(tenantGuard);
idempotencyKeySchema.index({ orgId: 1, key: 1 }, { unique: true });
idempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

const IdempotencyKey = mongoose.model('IdempotencyKey', idempotencyKeySchema);

function hashRequest(operation: string, userId: string, input: unknown): string {
  const json = JSON.stringify({ operation, userId, input }, (_, v: unknown) =>
    typeof v === 'bigint' ? v.toString() : v,
  );
  return createHash('sha256').update(json).digest('base64url');
}

export const KEY_REUSED: Outcome = {
  ok: false,
  userErrors: [
    {
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'This idempotency key was already used for a different request.',
      field: ['idempotencyKey'],
    },
  ],
};

/**
 * The stored outcome for this key, if the request was already processed. For operations with
 * side effects outside MongoDB (a gateway charge), check this *before* the side effect: a
 * replay must return the first outcome, not re-run business checks that the first run's own
 * writes would now fail (e.g. "plan unchanged" right after the plan was changed).
 */
export async function storedOutcome(
  operation: string,
  key: string,
  userId: string,
  input: unknown,
): Promise<Outcome | undefined> {
  const existing = await IdempotencyKey.findOne({ key }).lean().exec();
  if (!existing) return undefined;
  return existing.requestHash === hashRequest(operation, userId, input)
    ? (existing.outcome as Outcome)
    : KEY_REUSED;
}

/**
 * Runs `work` at most once per key, inside one transaction with the key record. `work` must do
 * all of its writes through the models (so they join the transaction) and nothing else.
 */
export async function idempotent(
  operation: string,
  key: string,
  userId: string,
  input: unknown,
  work: () => Promise<Outcome>,
): Promise<Outcome> {
  const requestHash = hashRequest(operation, userId, input);
  const attempt = () =>
    inTransaction(async () => {
      const existing = await IdempotencyKey.findOne({ key }).lean().exec();
      if (existing)
        return existing.requestHash === requestHash ? (existing.outcome as Outcome) : KEY_REUSED;
      const outcome = await work();
      await IdempotencyKey.create({ key, operation, requestHash, outcome });
      return outcome;
    });

  try {
    return await attempt();
  } catch (error) {
    // A concurrent request with the same key committed between our read and our insert. Its
    // outcome is now visible: run again, and the read at the top returns it.
    if (isDuplicateKeyError(error)) return attempt();
    throw error;
  }
}
