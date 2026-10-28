import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';
import { tenantGuard, tenantOrgId } from '../../data/tenant-guard.ts';

// Amounts are int64 minor units (BigInt). The domain Money type is rebuilt from them in
// invoice.mapper.ts; a JS number never holds money, not even here.
const lineSchema = new Schema(
  {
    description: { type: String, required: true },
    quantityThousandths: { type: Schema.Types.BigInt, required: true },
    unitPriceMinor: { type: Schema.Types.BigInt, required: true },
  },
  { _id: false },
);

const invoiceSchema = new Schema(
  {
    orgId: tenantOrgId,
    customerId: { type: Schema.Types.ObjectId, required: true },
    number: { type: String, default: null },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID'],
    },
    currency: { type: String, required: true },
    dueDate: { type: String, required: true },
    lines: { type: [lineSchema], default: [] },
    totalMinor: { type: Schema.Types.BigInt, required: true },
    paidMinor: { type: Schema.Types.BigInt, required: true },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);
invoiceSchema.plugin(tenantGuard);
invoiceSchema.index({ orgId: 1, createdAt: -1, _id: -1 });
invoiceSchema.index({ orgId: 1, status: 1, createdAt: -1, _id: -1 });
// The backstop for ADR-0002: even a bug in the counter cannot issue the same number twice.
invoiceSchema.index(
  { orgId: 1, number: 1 },
  { unique: true, partialFilterExpression: { number: { $type: 'string' } } },
);

export const Invoice = mongoose.model('Invoice', invoiceSchema);
export type InvoiceRecord = InferSchemaType<typeof invoiceSchema> & { _id: Types.ObjectId };
