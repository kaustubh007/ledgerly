import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';
import { tenantGuard, tenantOrgId } from '../../data/tenant-guard.ts';

const customerSchema = new Schema(
  {
    orgId: tenantOrgId,
    name: { type: String, required: true },
    /** Lower-cased name for case-insensitive prefix search on an index. */
    nameLower: { type: String, required: true },
    email: { type: String, default: null },
    defaultCurrency: { type: String, required: true },
    documentLocale: { type: String, required: true },
    billingAddress: { type: String, default: null },
  },
  { timestamps: true },
);
customerSchema.plugin(tenantGuard);
customerSchema.index({ orgId: 1, createdAt: -1, _id: -1 });
customerSchema.index({ orgId: 1, nameLower: 1 });

export const Customer = mongoose.model('Customer', customerSchema);
export type CustomerRecord = InferSchemaType<typeof customerSchema> & { _id: Types.ObjectId };
