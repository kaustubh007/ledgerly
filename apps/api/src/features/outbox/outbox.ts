import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';
import { currentOrgId } from '../../context/request-context.ts';

// Transactional outbox: an email is a row written in the same transaction as the change that
// causes it. If the transaction retries or rolls back, no email is sent twice or for nothing.
// A dispatcher (Phase 8: SQS → Lambda → SES) sends unsent rows and marks them sent.
const outboxSchema = new Schema(
  {
    kind: { type: String, required: true, enum: ['email'] },
    template: {
      type: String,
      required: true,
      enum: ['verify-email', 'reset-password', 'invitation', 'invoice-sent'],
    },
    to: { type: String, required: true },
    /** Template variables. May contain one-time links; cleared once sent. */
    data: { type: Schema.Types.Mixed, required: true },
    orgId: { type: Schema.Types.ObjectId, default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);
outboxSchema.index({ sentAt: 1, createdAt: 1 });

export const Outbox = mongoose.model('Outbox', outboxSchema);
export type OutboxRecord = InferSchemaType<typeof outboxSchema> & { _id: Types.ObjectId };

export type EmailTemplate = OutboxRecord['template'];

export async function enqueueEmail(
  template: EmailTemplate,
  to: string,
  data: Record<string, string>,
): Promise<void> {
  await Outbox.create({ kind: 'email', template, to, data, orgId: currentOrgId() ?? null });
}
