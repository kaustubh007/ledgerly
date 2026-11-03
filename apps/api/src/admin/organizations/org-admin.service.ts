import { Types } from 'mongoose';
import { PLANS, type PlanCode } from '@ledgerly/domain';
import type { UserError } from '@ledgerly/validation';
import { todayIn, type Clock } from '../../clock.ts';
import { runAsPlatform } from '../../context/platform-scope.ts';
import { inTransaction } from '../../data/connection.ts';
import { startOfMonthUtc } from '../../features/billing/limits.ts';
import { Customer } from '../../features/customers/customer.model.ts';
import { User } from '../../features/identity/user.model.ts';
import { Session } from '../../features/identity/session.model.ts';
import { Invoice } from '../../features/invoices/invoice.model.ts';
import { Invitation } from '../../features/organizations/invitation.model.ts';
import { Membership } from '../../features/organizations/membership.model.ts';
import {
  Organization,
  type OrganizationRecord,
} from '../../features/organizations/organization.model.ts';
import { money } from '../../graphql/money.ts';
import {
  afterCursor,
  decodeCursor,
  NEWEST_FIRST,
  pageSize,
  toConnection,
} from '../../graphql/pagination.ts';
import { audit } from '../audit/audit.ts';
import type { StaffCaller } from '../context.ts';
import '../platform-access.ts';
import type {
  CurrencyTotalParent,
  HealthParent,
  MemberParent,
  UsageParent,
} from './org-admin.types.ts';

const OPEN = ['SENT', 'PARTIALLY_PAID'] as const;

/** Runs tenant-model reads for one organisation in the platform scope (ADR-0004). */
function platform<T>(staff: StaffCaller, fn: () => Promise<T>): Promise<T> {
  return runAsPlatform({ staffId: staff.staffId, reason: null }, fn);
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function searchOrganizations(args: {
  search?: string | null;
  status?: 'ACTIVE' | 'SUSPENDED' | null;
  first?: number | null;
  after?: string | null;
}) {
  const size = pageSize(args.first);
  const cursor = args.after ? decodeCursor(args.after) : undefined;
  const term = args.search?.trim();
  const prefix = term ? new RegExp(`^${escapeRegex(term)}`, 'i') : undefined;
  const rows = await Organization.find({
    ...(prefix ? { $or: [{ name: prefix }, { slug: prefix }] } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(cursor ? afterCursor(cursor) : {}),
  })
    .sort(NEWEST_FIRST)
    .limit(size + 1)
    .lean()
    .exec();
  return toConnection(rows as (OrganizationRecord & { createdAt: Date })[], size);
}

export function organizationById(id: string): Promise<OrganizationRecord | null> {
  if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
  return Organization.findById(id).lean().exec();
}

export function memberCount(orgId: Types.ObjectId): Promise<number> {
  return Membership.countDocuments({ orgId }).exec();
}

export async function usageOf(
  staff: StaffCaller,
  org: OrganizationRecord,
  clock: Clock,
): Promise<UsageParent> {
  const orgId = org._id;
  const now = clock.now();
  const [customers, invoicesThisMonth, members, invitations] = await platform(staff, () =>
    Promise.all([
      Customer.countDocuments({ orgId }).exec(),
      Invoice.countDocuments({ orgId, createdAt: { $gte: startOfMonthUtc(now) } }).exec(),
      Membership.countDocuments({ orgId }).exec(),
      Invitation.countDocuments({ orgId, acceptedAt: null, expiresAt: { $gt: now } }).exec(),
    ]),
  );
  return { plan: org.plan, customers, invoicesThisMonth, seats: members + invitations };
}

export function planLimits(plan: PlanCode) {
  return PLANS[plan].limits;
}

/** Outstanding per currency: amounts in different currencies are never added together. */
export async function outstandingOf(
  staff: StaffCaller,
  orgId: Types.ObjectId,
): Promise<CurrencyTotalParent[]> {
  const rows = await platform(staff, () =>
    Invoice.aggregate<{ _id: string; amount: bigint | number; invoices: number }>([
      { $match: { orgId, status: { $in: OPEN } } },
      {
        $group: {
          _id: '$currency',
          amount: { $sum: { $subtract: ['$totalMinor', '$paidMinor'] } },
          invoices: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec(),
  );
  return rows.map((row) => ({
    currency: row._id,
    amount: money(BigInt(row.amount), row._id),
    invoices: row.invoices,
  }));
}

async function memberIds(orgId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const rows = await Membership.find({ orgId }, { userId: 1 }).lean().exec();
  return rows.map((row) => row.userId);
}

export async function healthOf(
  staff: StaffCaller,
  org: OrganizationRecord,
  clock: Clock,
): Promise<HealthParent> {
  const today = todayIn(org.timeZone, clock);
  const [overdueInvoices, latest] = await Promise.all([
    platform(staff, () =>
      Invoice.countDocuments({
        orgId: org._id,
        status: { $in: OPEN },
        dueDate: { $lt: today },
      }).exec(),
    ),
    memberIds(org._id).then((userIds) =>
      Session.findOne({ userId: { $in: userIds } }, { lastUsedAt: 1 })
        .sort({ lastUsedAt: -1 })
        .lean()
        .exec(),
    ),
  ]);
  return { overdueInvoices, lastActiveAt: latest?.lastUsedAt ?? null };
}

export async function membersOf(orgId: Types.ObjectId, clock: Clock): Promise<MemberParent[]> {
  const memberships = await Membership.find({ orgId }).sort({ createdAt: 1 }).lean().exec();
  const userIds = memberships.map((m) => m.userId);
  const [users, sessions] = await Promise.all([
    User.find({ _id: { $in: userIds } }, { name: 1, email: 1 })
      .lean()
      .exec(),
    Session.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { userId: { $in: userIds }, revokedAt: null, expiresAt: { $gt: clock.now() } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]).exec(),
  ]);
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const sessionsById = new Map(sessions.map((s) => [s._id.toString(), s.count]));
  return memberships.flatMap((m) => {
    const user = userById.get(m.userId.toString());
    if (!user) return [];
    return [
      {
        userId: m.userId,
        name: user.name,
        email: user.email,
        role: m.role,
        activeSessions: sessionsById.get(m.userId.toString()) ?? 0,
      },
    ];
  });
}

// ── OPS commands. Each one and its audit entry commit in one transaction. ─────────────────────

export type CommandOutcome =
  | { readonly ok: true; readonly orgId: Types.ObjectId }
  | { readonly ok: false; readonly userErrors: UserError[] };

const notFound: CommandOutcome = {
  ok: false,
  userErrors: [
    { code: 'NOT_FOUND', message: 'No such organisation.', field: ['input', 'organizationId'] },
  ],
};

export function setSuspended(
  clock: Clock,
  input: { organizationId: string; reason: string },
  suspended: boolean,
): Promise<CommandOutcome> {
  const orgId = new Types.ObjectId(input.organizationId);
  return inTransaction(async () => {
    const org = await Organization.findById(orgId, { status: 1 }).lean().exec();
    if (!org) return notFound;
    const target = suspended ? 'SUSPENDED' : 'ACTIVE';
    if (org.status === target) {
      return {
        ok: false,
        userErrors: [
          {
            code: suspended ? 'ALREADY_SUSPENDED' : 'NOT_SUSPENDED',
            message: suspended
              ? 'The organisation is already suspended.'
              : 'The organisation is not suspended.',
            field: [],
          },
        ],
      };
    }
    await Organization.updateOne(
      { _id: orgId },
      { status: target, suspendedAt: suspended ? clock.now() : null },
    ).exec();
    await audit({
      action: suspended ? 'organization.suspend' : 'organization.unsuspend',
      orgId,
      reason: input.reason,
    });
    return { ok: true, orgId };
  });
}

export function changePlan(
  clock: Clock,
  input: { organizationId: string; plan: PlanCode; reason: string },
): Promise<CommandOutcome> {
  const orgId = new Types.ObjectId(input.organizationId);
  return inTransaction(async () => {
    const org = await Organization.findById(orgId, { plan: 1 }).lean().exec();
    if (!org) return notFound;
    if (org.plan === input.plan) {
      return {
        ok: false,
        userErrors: [
          {
            code: 'PLAN_UNCHANGED',
            message: `The organisation is already on ${input.plan}.`,
            field: ['input', 'plan'],
          },
        ],
      };
    }
    await Organization.updateOne(
      { _id: orgId },
      { plan: input.plan, planChangedAt: clock.now() },
    ).exec();
    await audit({
      action: 'organization.changePlan',
      orgId,
      reason: input.reason,
      details: { from: org.plan, to: input.plan },
    });
    return { ok: true, orgId };
  });
}

export function revokeUserSessions(
  clock: Clock,
  input: { organizationId: string; userId: string; reason: string },
): Promise<{ revoked: number; userErrors: UserError[] }> {
  const orgId = new Types.ObjectId(input.organizationId);
  const userId = new Types.ObjectId(input.userId);
  return inTransaction(async () => {
    // Staff act on behalf of an organisation's support case: the user must belong to it.
    if (!(await Membership.exists({ orgId, userId }).exec())) {
      return {
        revoked: 0,
        userErrors: [
          {
            code: 'NOT_FOUND',
            message: 'No such member of this organisation.',
            field: ['input', 'userId'],
          },
        ],
      };
    }
    const result = await Session.updateMany(
      { userId, revokedAt: null },
      { revokedAt: clock.now(), revokedReason: 'REVOKED_BY_STAFF' },
    ).exec();
    await audit({
      action: 'user.revokeSessions',
      orgId,
      targetUserId: userId,
      reason: input.reason,
      details: { revoked: result.modifiedCount },
    });
    return { revoked: result.modifiedCount, userErrors: [] };
  });
}
