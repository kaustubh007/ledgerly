import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

// The tenant itself. Global: it is looked up by slug before the tenant context exists.
const organizationSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    timeZone: { type: String, required: true, default: 'UTC' },
    plan: { type: String, required: true, enum: ['FREE', 'PRO', 'BUSINESS'], default: 'FREE' },
    planChangedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Organization = mongoose.model('Organization', organizationSchema);
export type OrganizationRecord = InferSchemaType<typeof organizationSchema> & {
  _id: Types.ObjectId;
};
