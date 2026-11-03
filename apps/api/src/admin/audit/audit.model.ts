import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

// The platform audit log (ADR-0004): one entry per admin read or write, append-only. Global,
// not tenant data: staff read it across organisations. Nothing in the code updates or deletes it.
const auditEntrySchema = new Schema(
  {
    /** Null for a failed sign-in, where no staff member is established. */
    staffId: { type: Schema.Types.ObjectId, default: null },
    /** Dotted verb, e.g. `organization.suspend`, `organization.view`, `staff.signIn`. */
    action: { type: String, required: true },
    orgId: { type: Schema.Types.ObjectId, default: null },
    targetUserId: { type: Schema.Types.ObjectId, default: null },
    /** Required for OPS actions; null for reads. */
    reason: { type: String, default: null },
    /** Small, non-sensitive context: a search term, a plan change, a count. Never tenant data. */
    details: { type: Schema.Types.Mixed, default: null },
    requestId: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditEntrySchema.index({ createdAt: -1, _id: -1 });
auditEntrySchema.index({ orgId: 1, createdAt: -1 });
auditEntrySchema.index({ staffId: 1, createdAt: -1 });
auditEntrySchema.index({ action: 1, createdAt: -1 });

export const AuditEntry = mongoose.model('AuditEntry', auditEntrySchema);
export type AuditEntryRecord = InferSchemaType<typeof auditEntrySchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};
