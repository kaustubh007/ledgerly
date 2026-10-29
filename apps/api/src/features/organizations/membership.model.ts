import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

// Global, because "which organisations does this user belong to?" crosses tenants by definition.
// Every query that is about one organisation must filter by the context org explicitly; there is
// no plugin to catch a missing filter here, so these queries live only in this feature.
const membershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    orgId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, required: true, enum: ['OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER'] },
  },
  { timestamps: true },
);
membershipSchema.index({ userId: 1, orgId: 1 }, { unique: true });
membershipSchema.index({ orgId: 1, role: 1 });

export const Membership = mongoose.model('Membership', membershipSchema);
export type MembershipRecord = InferSchemaType<typeof membershipSchema> & { _id: Types.ObjectId };
