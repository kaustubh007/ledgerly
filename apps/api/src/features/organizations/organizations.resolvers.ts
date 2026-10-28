import { Types } from 'mongoose';
import { assignableRoles, checkMembershipChange } from '@ledgerly/domain';
import {
  InviteMemberInput,
  OrganizationName,
  parseInput,
  type UserError,
} from '@ledgerly/validation';
import { runInTenant } from '../../context/request-context.ts';
import { inTransaction } from '../../data/connection.ts';
import { requireTenant, requireUser } from '../../graphql/context.ts';
import { objectId } from '../../graphql/ids.ts';
import type { Resolvers } from '../../graphql/__generated__/resolvers.ts';
import { OneTimeToken } from '../identity/one-time-token.model.ts';
import { hashToken, randomToken } from '../identity/tokens.ts';
import { User } from '../identity/user.model.ts';
import { enqueueEmail } from '../outbox/outbox.ts';
import { Invitation } from './invitation.model.ts';
import { Membership } from './membership.model.ts';
import { Organization } from './organization.model.ts';
import type { MemberParent } from './member.types.ts';
import { createOrganization } from './organizations.service.ts';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const error = (code: string, message: string, field: string[] = []): UserError[] => [
  { code, message, field },
];

const MEMBERSHIP_REFUSALS: Record<string, string> = {
  NOT_ALLOWED: 'You cannot manage members.',
  OWNER_ONLY: 'Only an owner can grant, change or remove the owner role.',
  LAST_OWNER: 'An organisation must keep at least one owner.',
};

/** Members of the context organisation. Membership is global, so orgId is filtered explicitly. */
async function membersOf(orgId: string): Promise<MemberParent[]> {
  const memberships = await Membership.find({ orgId: new Types.ObjectId(orgId) })
    .sort({ createdAt: 1 })
    .lean()
    .exec();
  const users = await User.find(
    { _id: { $in: memberships.map((m) => m.userId) } },
    { name: 1, email: 1 },
  )
    .lean()
    .exec();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  return memberships.flatMap((m) => {
    const user = byId.get(m.userId.toString());
    return user
      ? [
          {
            userId: m.userId,
            role: m.role,
            joinedAt: m.createdAt,
            name: user.name,
            email: user.email,
          },
        ]
      : [];
  });
}

async function memberOf(orgId: string, userId: Types.ObjectId) {
  return Membership.findOne({ orgId: new Types.ObjectId(orgId), userId })
    .lean()
    .exec();
}

async function ownerCount(orgId: string): Promise<number> {
  return Membership.countDocuments({ orgId: new Types.ObjectId(orgId), role: 'OWNER' });
}

export const organizationsResolvers: Resolvers = {
  Query: {
    organization: async () => {
      const { orgId } = requireTenant();
      return Organization.findById(orgId).lean().exec();
    },
  },
  Mutation: {
    createOrganization: async (_, { name }) => {
      const { userId } = requireUser();
      const parsed = parseInput(OrganizationName, name, ['name']);
      if (!parsed.ok) return { organization: null, userErrors: parsed.userErrors };
      const organization = await inTransaction(() =>
        createOrganization(new Types.ObjectId(userId), parsed.value),
      );
      return { organization, userErrors: [] };
    },

    inviteMember: async (_, args, ctx) => {
      const { userId, orgId, role } = requireTenant('members:manage');
      const parsed = parseInput(InviteMemberInput, args, []);
      if (!parsed.ok) return { invitation: null, userErrors: parsed.userErrors };
      const { email } = parsed.value;
      const invitedRole = parsed.value.role;
      if (!assignableRoles(role).includes(invitedRole)) {
        return {
          invitation: null,
          userErrors: error('OWNER_ONLY', MEMBERSHIP_REFUSALS['OWNER_ONLY'] ?? '', ['role']),
        };
      }
      const existingUser = await User.findOne({ email }, { _id: 1 }).lean().exec();
      if (existingUser && (await memberOf(orgId, existingUser._id))) {
        return {
          invitation: null,
          userErrors: error('ALREADY_MEMBER', 'This person is already a member.', ['email']),
        };
      }

      const now = ctx.deps.clock.now();
      const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
      const token = randomToken();
      const invitation = await inTransaction(async () => {
        // Re-inviting refreshes the invitation; any earlier link stops working.
        const inv = await Invitation.findOneAndUpdate(
          { email },
          {
            $set: {
              role: invitedRole,
              invitedBy: new Types.ObjectId(userId),
              expiresAt,
              acceptedAt: null,
            },
          },
          { upsert: true, returnDocument: 'after', lean: true },
        )
          .orFail()
          .exec(); // with upsert there is always a document
        await OneTimeToken.deleteMany({ purpose: 'INVITATION', invitationId: inv._id });
        await OneTimeToken.create([
          {
            purpose: 'INVITATION',
            hash: hashToken(token),
            orgId: inv.orgId,
            invitationId: inv._id,
            expiresAt,
          },
        ]);
        const org = await Organization.findById(orgId, { name: 1 }).lean().orFail().exec();
        await enqueueEmail('invitation', email, {
          organization: org.name,
          link: `${ctx.deps.config.PUBLIC_ORIGIN}/invitations/accept?token=${token}`,
        });
        return inv;
      });
      return { invitation, userErrors: [] };
    },

    acceptInvitation: async (_, { token }, ctx) => {
      const { userId } = requireUser();
      const invalid = {
        organization: null,
        userErrors: error('INVALID_TOKEN', 'This invitation is invalid or has expired.', ['token']),
      };
      const now = ctx.deps.clock.now();
      const record = await OneTimeToken.findOne({
        purpose: 'INVITATION',
        hash: hashToken(token),
        usedAt: null,
        expiresAt: { $gt: now },
      })
        .lean()
        .exec();
      if (!record?.orgId || !record.invitationId) return invalid;
      const { orgId, invitationId } = record;

      const user = await User.findById(userId, { email: 1 }).lean().orFail().exec();
      // The token proves access to the invited mailbox; the account must be that mailbox too.
      return runInTenant(orgId.toString(), 'VIEWER', () =>
        inTransaction(async () => {
          const invitation = await Invitation.findOne({ _id: invitationId, acceptedAt: null })
            .lean()
            .exec();
          if (!invitation) return invalid;
          if (invitation.email !== user.email) {
            return {
              organization: null,
              userErrors: error(
                'EMAIL_MISMATCH',
                'This invitation was sent to a different email address.',
                ['token'],
              ),
            };
          }
          const used = await OneTimeToken.updateOne(
            { _id: record._id, usedAt: null },
            { usedAt: now },
          );
          if (used.modifiedCount !== 1) return invalid;
          await Invitation.updateOne({ _id: invitationId }, { acceptedAt: now });
          if (!(await memberOf(orgId.toString(), user._id))) {
            await Membership.create([{ userId: user._id, orgId, role: invitation.role }]);
          }
          return { organization: await Organization.findById(orgId).lean().exec(), userErrors: [] };
        }),
      );
    },

    changeMemberRole: async (_, { userId: targetId, role: newRole }) => {
      const { orgId, role } = requireTenant('members:manage');
      const target = objectId(targetId);
      return inTransaction(async () => {
        const membership = target ? await memberOf(orgId, target) : null;
        if (!target || !membership)
          return { member: null, userErrors: error('NOT_FOUND', 'No such member.', ['userId']) };
        const refusal = checkMembershipChange({
          actorRole: role,
          from: membership.role,
          to: newRole,
          ownerCount: await ownerCount(orgId),
        });
        if (refusal)
          return {
            member: null,
            userErrors: error(refusal, MEMBERSHIP_REFUSALS[refusal] ?? refusal, ['role']),
          };
        await Membership.updateOne({ _id: membership._id }, { role: newRole });
        const member = (await membersOf(orgId)).find((m) => m.userId.equals(target)) ?? null;
        return { member, userErrors: [] };
      });
    },

    removeMember: async (_, { userId: targetId }) => {
      const { orgId, role } = requireTenant('members:manage');
      const target = objectId(targetId);
      return inTransaction(async () => {
        const membership = target ? await memberOf(orgId, target) : null;
        if (!membership)
          return { ok: false, userErrors: error('NOT_FOUND', 'No such member.', ['userId']) };
        const refusal = checkMembershipChange({
          actorRole: role,
          from: membership.role,
          to: null,
          ownerCount: await ownerCount(orgId),
        });
        if (refusal)
          return {
            ok: false,
            userErrors: error(refusal, MEMBERSHIP_REFUSALS[refusal] ?? refusal, ['userId']),
          };
        await Membership.deleteOne({ _id: membership._id });
        return { ok: true, userErrors: [] };
      });
    },
  },
  Organization: {
    id: (org) => org._id.toString(),
    slug: (org) => org.slug,
    name: (org) => org.name,
    timeZone: (org) => org.timeZone,
    viewerRole: () => requireTenant().role,
    members: () => membersOf(requireTenant('members:manage').orgId),
    invitations: (_, __, ctx) => {
      requireTenant('members:manage');
      return Invitation.find({ acceptedAt: null, expiresAt: { $gt: ctx.deps.clock.now() } })
        .sort({ createdAt: -1 })
        .lean()
        .exec();
    },
  },
  Member: {
    userId: (m) => m.userId.toString(),
    name: (m) => m.name,
    email: (m) => m.email,
    role: (m) => m.role,
    joinedAt: (m) => m.joinedAt,
  },
  Invitation: {
    id: (inv) => inv._id.toString(),
    email: (inv) => inv.email,
    role: (inv) => inv.role,
    expiresAt: (inv) => inv.expiresAt,
  },
};
