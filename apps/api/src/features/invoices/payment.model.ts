import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';
import { tenantGuard, tenantOrgId } from '../../data/tenant-guard.ts';

const paymentSchema = new Schema(
  {
    orgId: tenantOrgId,
    invoiceId: { type: Schema.Types.ObjectId, required: true },
    amountMinor: { type: Schema.Types.BigInt, required: true },
    currency: { type: String, required: true },
    recordedBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);
paymentSchema.plugin(tenantGuard);
paymentSchema.index({ orgId: 1, invoiceId: 1, createdAt: 1 });

export const Payment = mongoose.model('Payment', paymentSchema);
export type PaymentRecord = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId };
