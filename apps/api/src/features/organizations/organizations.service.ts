import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import type { Role } from '@ledgerly/domain';
import { isDuplicateKeyError } from '../../data/connection.ts';
import { Membership } from './membership.model.ts';
import { Organization, type OrganizationRecord } from './organization.model.ts';

export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents: "Café" → "Cafe"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug.length >= 2 ? slug : 'org';
}

/**
 * Creates an organisation with `userId` as its first OWNER. Call inside a transaction.
 * Slugs are unique; on a clash a short random suffix is added.
 */
export async function createOrganization(
  userId: Types.ObjectId,
  name: string,
): Promise<OrganizationRecord> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
    if (await Organization.exists({ slug })) continue;
    try {
      const [org] = await Organization.create([{ slug, name }]);
      if (!org) throw new Error('Organization.create returned nothing.');
      await Membership.create([{ userId, orgId: org._id, role: 'OWNER' satisfies Role }]);
      return org.toObject();
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }
  throw new Error('Could not allocate an organisation slug.');
}

/** The user's role in the organisation with this slug, or undefined if not a member. */
export async function resolveMembership(
  userId: string,
  slug: string,
): Promise<{ orgId: string; role: Role } | undefined> {
  const org = await Organization.findOne({ slug }, { _id: 1 }).lean().exec();
  if (!org) return undefined;
  const membership = await Membership.findOne(
    { userId: new Types.ObjectId(userId), orgId: org._id },
    { role: 1 },
  )
    .lean()
    .exec();
  return membership ? { orgId: org._id.toString(), role: membership.role } : undefined;
}
