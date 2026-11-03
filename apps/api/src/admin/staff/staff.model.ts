import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

// Ledgerly's own support and operations people (ADR-0004). A separate identity from tenant users:
// separate collection, login, cookie and schema. Created with `pnpm --filter @ledgerly/api
// staff:create`; there is no self sign-up.
const staffSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ['SUPPORT', 'OPS'] },
    /** AES-256-GCM of the Base32 TOTP secret. Null until the first sign-in enrols one. */
    totpSecret: { type: String, default: null },
    totpEnabledAt: { type: Date, default: null },
    /** The last accepted TOTP time step: a code is accepted once (replay protection). */
    totpLastStep: { type: Number, default: 0 },
    /** SHA-256 hashes of unused recovery codes; a used code is removed. */
    recoveryCodeHashes: { type: [String], default: [] },
    disabledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Staff = mongoose.model('Staff', staffSchema);
export type StaffRecord = InferSchemaType<typeof staffSchema> & { _id: Types.ObjectId };
