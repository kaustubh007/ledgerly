import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

// A staff sign-in. Stricter than a tenant session (ADR-0004): 8 hours absolute, 30 minutes idle,
// no refresh token. The cookie holds a random token; only its hash is stored.
const staffSessionSchema = new Schema(
  {
    staffId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);
staffSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const StaffSession = mongoose.model('StaffSession', staffSessionSchema);
export type StaffSessionRecord = InferSchemaType<typeof staffSessionSchema> & {
  _id: Types.ObjectId;
};

// The step between password and TOTP: valid for 5 minutes and 5 attempts. During enrolment it
// carries the new (encrypted) secret until the first code proves the authenticator has it.
const mfaChallengeSchema = new Schema(
  {
    staffId: { type: Schema.Types.ObjectId, required: true },
    tokenHash: { type: String, required: true, unique: true },
    pendingTotpSecret: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
mfaChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MfaChallenge = mongoose.model('MfaChallenge', mfaChallengeSchema);
