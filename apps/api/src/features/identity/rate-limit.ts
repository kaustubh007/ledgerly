import mongoose, { Schema } from 'mongoose';
import type { Clock } from '../../clock.ts';

// Fixed-window counters in MongoDB, so the limit holds across every API task, not per process.
const rateLimitSchema = new Schema({
  key: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
});
rateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit = mongoose.model('RateLimit', rateLimitSchema);

export interface Limit {
  readonly max: number;
  readonly windowMs: number;
}

export const LIMITS = {
  loginPerEmail: { max: 10, windowMs: 15 * 60_000 },
  loginPerIp: { max: 100, windowMs: 15 * 60_000 },
  signUpPerIp: { max: 20, windowMs: 60 * 60_000 },
  passwordResetPerEmail: { max: 5, windowMs: 60 * 60_000 },
} as const satisfies Record<string, Limit>;

/** Counts one attempt. Returns true when the limit was already reached (refuse the attempt). */
export async function isRateLimited(key: string, limit: Limit, clock: Clock): Promise<boolean> {
  const now = clock.now().getTime();
  const windowStart = new Date(now - (now % limit.windowMs));
  const counter = await RateLimit.findOneAndUpdate(
    { key, windowStart },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(windowStart.getTime() + limit.windowMs) },
    },
    { upsert: true, returnDocument: 'after', lean: true },
  )
    .orFail()
    .exec(); // with upsert there is always a document
  return counter.count > limit.max;
}
