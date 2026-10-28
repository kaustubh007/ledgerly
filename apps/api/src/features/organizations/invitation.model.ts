import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';
import { tenantGuard, tenantOrgId } from '../../data/tenant-guard.ts';

const invitationSchema = new Schema(
  {
    orgId: tenantOrgId,
    email: { type: String, required: true },
    role: { type: String, required: true, enum: ['OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER'] },
    invitedBy: { type: Schema.Types.ObjectId, required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
invitationSchema.plugin(tenantGuard);
// One open invitation per email per organisation; re-inviting refreshes it.
invitationSchema.index({ orgId: 1, email: 1 }, { unique: true });

export const Invitation = mongoose.model('Invitation', invitationSchema);
export type InvitationRecord = InferSchemaType<typeof invitationSchema> & { _id: Types.ObjectId };
