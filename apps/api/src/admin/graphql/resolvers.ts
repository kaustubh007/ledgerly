import { Types } from 'mongoose';
import {
  AuditLogFilter,
  ChangeOrganizationPlanInput,
  OrganizationActionInput,
  parseInput,
  RevokeUserSessionsInput,
} from '@ledgerly/validation';
import { currentContext } from '../../context/request-context.ts';
import {
  afterCursor,
  decodeCursor,
  NEWEST_FIRST,
  pageSize,
  toConnection,
} from '../../graphql/pagination.ts';
import { AuditEntry } from '../audit/audit.model.ts';
import { audit } from '../audit/audit.ts';
import { requireStaff, type AdminContext } from '../context.ts';
import {
  changePlan,
  healthOf,
  memberCount,
  membersOf,
  organizationById,
  outstandingOf,
  planLimits,
  revokeUserSessions,
  searchOrganizations,
  setSuspended,
  usageOf,
  type CommandOutcome,
} from '../organizations/org-admin.service.ts';
import {
  clearStaffCookies,
  MFA_CHALLENGE_COOKIE,
  setChallengeCookie,
  setSessionCookie,
} from '../staff/cookies.ts';
import { signIn, signOut, verifyMfa } from '../staff/staff-auth.service.ts';
import type { Resolvers } from './__generated__/resolvers.ts';

// Every Query and Mutation field writes an audit entry (ADR-0004), except `me`, which only reads
// the caller's own record. test/admin.test.ts enforces this against the schema.

function clientMeta() {
  const context = currentContext();
  return { ip: context?.ip ?? '', userAgent: context?.userAgent };
}

function cookie(ctx: AdminContext, name: string): string | undefined {
  const value: unknown = (ctx.req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

async function orgPayload(outcome: CommandOutcome) {
  if (!outcome.ok) return { organization: null, userErrors: outcome.userErrors };
  return { organization: await organizationById(outcome.orgId.toString()), userErrors: [] };
}

export const adminResolvers: Resolvers = {
  Query: {
    me: (_, __, ctx) => {
      const staff = currentContext()?.staff;
      return staff ? ctx.loaders.staff.load(staff.staffId).then((s) => s ?? null) : null;
    },
    organizations: async (_, args) => {
      requireStaff();
      const connection = await searchOrganizations(args);
      await audit({
        action: 'organization.search',
        details: { search: args.search ?? null, status: args.status ?? null },
      });
      return connection;
    },
    organization: async (_, { id }) => {
      requireStaff();
      const org = await organizationById(id);
      await audit({
        action: 'organization.view',
        orgId: org?._id ?? null,
        details: org ? null : { id },
      });
      return org;
    },
    auditLog: async (_, { filter, first, after }) => {
      requireStaff();
      const parsed = parseInput(AuditLogFilter, filter ?? {}, ['filter']);
      const f = parsed.ok ? parsed.value : {};
      const size = pageSize(first);
      const cursor = after ? decodeCursor(after) : undefined;
      const rows = await AuditEntry.find({
        ...(f.organizationId ? { orgId: new Types.ObjectId(f.organizationId) } : {}),
        ...(f.staffId ? { staffId: new Types.ObjectId(f.staffId) } : {}),
        ...(f.action ? { action: f.action } : {}),
        ...(cursor ? afterCursor(cursor) : {}),
      })
        .sort(NEWEST_FIRST)
        .limit(size + 1)
        .lean()
        .exec();
      await audit({ action: 'audit.view', details: { filter: f } });
      return toConnection(rows, size);
    },
  },
  Mutation: {
    signIn: async (_, { input }, ctx) => {
      const result = await signIn(ctx.deps, input, clientMeta());
      if (result.kind === 'refused')
        return { next: null, enrolment: null, userErrors: result.userErrors };
      setChallengeCookie(ctx.res, result.challengeToken);
      return { next: result.next, enrolment: result.enrolment, userErrors: [] };
    },
    verifyMfa: async (_, { input }, ctx) => {
      const result = await verifyMfa(
        ctx.deps,
        cookie(ctx, MFA_CHALLENGE_COOKIE),
        input,
        clientMeta(),
      );
      if (result.kind === 'refused')
        return { staff: null, recoveryCodes: null, userErrors: result.userErrors };
      setSessionCookie(ctx.res, result.sessionToken);
      return { staff: result.staff, recoveryCodes: result.recoveryCodes, userErrors: [] };
    },
    signOut: async (_, __, ctx) => {
      const staff = currentContext()?.staff;
      if (staff) {
        await signOut(ctx.deps, staff.sessionId);
        await audit({ action: 'staff.signOut' });
      }
      clearStaffCookies(ctx.res);
      return true;
    },
    suspendOrganization: async (_, { input }, ctx) => {
      requireStaff('OPS');
      const parsed = parseInput(OrganizationActionInput, input);
      if (!parsed.ok) return { organization: null, userErrors: parsed.userErrors };
      return orgPayload(await setSuspended(ctx.deps.clock, parsed.value, true));
    },
    unsuspendOrganization: async (_, { input }, ctx) => {
      requireStaff('OPS');
      const parsed = parseInput(OrganizationActionInput, input);
      if (!parsed.ok) return { organization: null, userErrors: parsed.userErrors };
      return orgPayload(await setSuspended(ctx.deps.clock, parsed.value, false));
    },
    changeOrganizationPlan: async (_, { input }, ctx) => {
      requireStaff('OPS');
      const parsed = parseInput(ChangeOrganizationPlanInput, input);
      if (!parsed.ok) return { organization: null, userErrors: parsed.userErrors };
      return orgPayload(await changePlan(ctx.deps.clock, parsed.value));
    },
    revokeUserSessions: async (_, { input }, ctx) => {
      requireStaff('OPS');
      const parsed = parseInput(RevokeUserSessionsInput, input);
      if (!parsed.ok) return { revoked: 0, userErrors: parsed.userErrors };
      return revokeUserSessions(ctx.deps.clock, parsed.value);
    },
  },
  Staff: {
    id: (s) => s._id.toString(),
    email: (s) => s.email,
    name: (s) => s.name,
    role: (s) => s.role,
  },
  Organization: {
    id: (o) => o._id.toString(),
    name: (o) => o.name,
    slug: (o) => o.slug,
    plan: (o) => o.plan,
    status: (o) => o.status,
    createdAt: (o) => o.createdAt,
    suspendedAt: (o) => o.suspendedAt ?? null,
    memberCount: (o) => memberCount(o._id),
    usage: (o, _, ctx) => usageOf(requireStaff(), o, ctx.deps.clock),
    outstanding: (o) => outstandingOf(requireStaff(), o._id),
    health: (o, _, ctx) => healthOf(requireStaff(), o, ctx.deps.clock),
    members: (o, _, ctx) => membersOf(o._id, ctx.deps.clock),
  },
  Usage: {
    customers: (u) => u.customers,
    invoicesThisMonth: (u) => u.invoicesThisMonth,
    seats: (u) => u.seats,
    customersLimit: (u) => planLimits(u.plan).customers,
    invoicesPerMonthLimit: (u) => planLimits(u.plan).invoicesPerMonth,
    seatsLimit: (u) => planLimits(u.plan).seats,
  },
  CurrencyTotal: {
    currency: (t) => t.currency,
    amount: (t) => t.amount,
    invoices: (t) => t.invoices,
  },
  Money: {
    amount: (m) => m.toDecimalString(),
    currency: (m) => m.currency.code,
  },
  Health: {
    lastActiveAt: (h) => h.lastActiveAt,
    overdueInvoices: (h) => h.overdueInvoices,
  },
  Member: {
    userId: (m) => m.userId.toString(),
    name: (m) => m.name,
    email: (m) => m.email,
    role: (m) => m.role,
    activeSessions: (m) => m.activeSessions,
  },
  AuditEntry: {
    id: (e) => e._id.toString(),
    at: (e) => e.createdAt,
    staff: async (e, _, ctx) =>
      e.staffId ? ((await ctx.loaders.staff.load(e.staffId.toString())) ?? null) : null,
    action: (e) => e.action,
    organizationId: (e) => e.orgId?.toString() ?? null,
    organizationName: async (e, _, ctx) =>
      e.orgId ? ((await ctx.loaders.orgName.load(e.orgId.toString())) ?? null) : null,
    targetUserId: (e) => e.targetUserId?.toString() ?? null,
    reason: (e) => e.reason ?? null,
  },
};
