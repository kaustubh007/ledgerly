import mongoose, { Schema } from 'mongoose';
import { tenantGuard, tenantOrgId } from '../../data/tenant-guard.ts';

const counterSchema = new Schema({
  orgId: tenantOrgId,
  name: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});
counterSchema.plugin(tenantGuard);
counterSchema.index({ orgId: 1, name: 1 }, { unique: true });

const Counter = mongoose.model('Counter', counterSchema);

/**
 * Next value of a per-organisation sequence. Must run inside the transaction that uses the
 * number: if that transaction aborts, the increment is rolled back too, so no gaps (ADR-0002).
 */
export async function nextSequence(name: string): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', lean: true },
  )
    .orFail()
    .exec(); // with upsert there is always a document
  return counter.seq;
}
