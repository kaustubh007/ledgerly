import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

// Global (not tenant) data: a user exists once and may belong to many organisations.
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    emailVerifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);
export type UserRecord = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
