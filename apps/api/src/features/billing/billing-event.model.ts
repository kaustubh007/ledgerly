import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';
import { tenantGuard, tenantOrgId } from '../../data/tenant-guard.ts';

// The organisation's billing history: every plan change, with what was charged and by whom.
const billingEventSchema = new Schema(
  {
    orgId: tenantOrgId,
    type: { type: String, required: true, enum: ['PLAN_CHANGED'] },
    fromPlan: { type: String, required: true },
    toPlan: { type: String, required: true },
    amountMinor: { type: Schema.Types.BigInt, required: true },
    currency: { type: String, required: true },
    chargeId: { type: String, default: null },
    actorId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);
billingEventSchema.plugin(tenantGuard);
billingEventSchema.index({ orgId: 1, createdAt: -1 });

export const BillingEvent = mongoose.model('BillingEvent', billingEventSchema);
export type BillingEventRecord = InferSchemaType<typeof billingEventSchema> & {
  _id: Types.ObjectId;
};
