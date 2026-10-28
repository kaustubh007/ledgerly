import { currentContext } from '../../context/request-context.ts';
import type { GraphQLContext } from '../../graphql/context.ts';
import { requireUser } from '../../graphql/context.ts';
import type { Resolvers } from '../../graphql/__generated__/resolvers.ts';
import { Membership } from '../organizations/membership.model.ts';
import { Organization } from '../organizations/organization.model.ts';
import {
  logIn,
  requestPasswordReset,
  resetPassword,
  revokeOtherSessions,
  revokeSession,
  signUp,
  verifyEmail,
  type AuthOutcome,
  type ClientMeta,
} from './auth.service.ts';
import { setSessionCookies } from './cookies.ts';
import { Session } from './session.model.ts';
import { User } from './user.model.ts';

function clientMeta(): ClientMeta {
  const ctx = currentContext();
  return { ip: ctx?.ip ?? '', userAgent: ctx?.userAgent };
}

async function toAuthPayload(outcome: AuthOutcome, ctx: GraphQLContext) {
  if (!outcome.ok) return { viewer: null, userErrors: outcome.userErrors };
  setSessionCookies(ctx.res, outcome.access, outcome.refresh);
  const viewer = await User.findById(outcome.userId).lean().exec();
  return { viewer, userErrors: [] };
}

const ok = { ok: true, userErrors: [] };

export const identityResolvers: Resolvers = {
  Query: {
    viewer: async () => {
      const user = currentContext()?.user;
      return user ? await User.findById(user.userId).lean().exec() : null;
    },
  },
  Mutation: {
    signUp: async (_, { input }, ctx) =>
      toAuthPayload(await signUp(ctx.deps, input, clientMeta()), ctx),
    logIn: async (_, { input }, ctx) =>
      toAuthPayload(await logIn(ctx.deps, input, clientMeta()), ctx),
    verifyEmail: async (_, { token }, ctx) => {
      const userErrors = await verifyEmail(ctx.deps, token);
      return { ok: userErrors.length === 0, userErrors };
    },
    requestPasswordReset: async (_, { email }, ctx) => {
      await requestPasswordReset(ctx.deps, email);
      return ok;
    },
    resetPassword: async (_, { input }, ctx) => {
      const userErrors = await resetPassword(ctx.deps, input);
      return { ok: userErrors.length === 0, userErrors };
    },
    revokeSession: async (_, { id }, ctx) => {
      const { userId } = requireUser();
      const revoked = await revokeSession(ctx.deps, userId, id, 'REVOKED_BY_USER');
      return revoked
        ? ok
        : {
            ok: false,
            userErrors: [{ code: 'NOT_FOUND', message: 'No such session.', field: ['id'] }],
          };
    },
    revokeOtherSessions: async (_, __, ctx) => {
      const { userId, sessionId } = requireUser();
      await revokeOtherSessions(ctx.deps, userId, sessionId);
      return ok;
    },
  },
  Viewer: {
    id: (user) => user._id.toString(),
    email: (user) => user.email,
    name: (user) => user.name,
    emailVerified: (user) => user.emailVerifiedAt != null,
    memberships: (user) =>
      Membership.find({ userId: user._id }).sort({ createdAt: 1 }).lean().exec(),
    sessions: async (user, _, ctx) => {
      // Only your own sessions, even if someone resolves a Viewer for another user later.
      if (requireUser().userId !== user._id.toString()) return [];
      return Session.find({
        userId: user._id,
        revokedAt: null,
        expiresAt: { $gt: ctx.deps.clock.now() },
      })
        .sort({ lastUsedAt: -1 })
        .lean()
        .exec();
    },
  },
  Membership: {
    role: (m) => m.role,
    organization: async (m) => Organization.findById(m.orgId).lean().orFail().exec(),
  },
  OrganizationSummary: {
    id: (org) => org._id.toString(),
    slug: (org) => org.slug,
    name: (org) => org.name,
  },
  Session: {
    id: (s) => s._id.toString(),
    current: (s) => currentContext()?.user?.sessionId === s._id.toString(),
    userAgent: (s) => s.userAgent ?? null,
    createdAt: (s) => s.createdAt,
    lastUsedAt: (s) => s.lastUsedAt,
  },
};
