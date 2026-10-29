import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

// One document per sign-in ("token family", ADR-0003). The refresh token rotates inside it.
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    /** SHA-256 of the current refresh token. */
    refreshHash: { type: String, required: true, unique: true },
    /** The token rotated out most recently, kept for the grace window. */
    previous: {
      type: new Schema(
        {
          hash: { type: String, required: true },
          rotatedAt: { type: Date, required: true },
          /** AES-256-GCM of the successor token, so a racing tab gets the same one. */
          successor: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    /** Older rotated-out hashes. Presenting one is reuse, and revokes the session. */
    retiredHashes: { type: [String], default: [], index: true },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
    lastUsedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
  },
  { timestamps: true },
);
sessionSchema.index({ 'previous.hash': 1 }, { sparse: true });

export const Session = mongoose.model('Session', sessionSchema);
export type SessionRecord = InferSchemaType<typeof sessionSchema> & { _id: Types.ObjectId };
