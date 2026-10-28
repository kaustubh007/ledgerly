import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

// Global: the token arrives before we know the user or the organisation, so it cannot live in a
// tenant collection. Only the hash is stored; the token itself exists only in the email.
const oneTimeTokenSchema = new Schema(
  {
    purpose: {
      type: String,
      required: true,
      enum: ['VERIFY_EMAIL', 'RESET_PASSWORD', 'INVITATION'],
    },
    hash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, default: null },
    orgId: { type: Schema.Types.ObjectId, default: null },
    invitationId: { type: Schema.Types.ObjectId, default: null },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// Expired tokens are deleted by MongoDB a day after expiry.
oneTimeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });

export const OneTimeToken = mongoose.model('OneTimeToken', oneTimeTokenSchema);
export type OneTimeTokenRecord = InferSchemaType<typeof oneTimeTokenSchema> & {
  _id: Types.ObjectId;
};
