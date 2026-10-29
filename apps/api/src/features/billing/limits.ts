import { Types } from 'mongoose';
import { canAdd, PLANS, type LimitedResource, type PlanCode } from '@ledgerly/domain';
import type { UserError } from '@ledgerly/validation';
import type { Clock } from '../../clock.ts';
import { currentOrgId } from '../../context/request-context.ts';
import { Customer } from '../customers/customer.model.ts';
import { touchLock } from '../invoices/counter.model.ts';
import { Invoice } from '../invoices/invoice.model.ts';
import { Invitation } from '../organizations/invitation.model.ts';
import { Membership } from '../organizations/membership.model.ts';
import { Organization } from '../organizations/organization.model.ts';

export type Usage = Readonly<Record<LimitedResource, number>>;

export function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function requireOrgId(): string {
  const orgId = currentOrgId();
  if (orgId === undefined) throw new Error('Plan limits need an organisation in context.');
  return orgId;
}

/** Current consumption of every limited resource in the context organisation. */
export async function usageOf(clock: Clock): Promise<Usage> {
  const orgId = new Types.ObjectId(requireOrgId());
  const now = clock.now();
  const [customers, invoicesPerMonth, members, invitations] = await Promise.all([
    Customer.countDocuments().exec(),
    Invoice.countDocuments({ createdAt: { $gte: startOfMonthUtc(now) } }).exec(),
    Membership.countDocuments({ orgId }).exec(),
    Invitation.countDocuments({ acceptedAt: null, expiresAt: { $gt: now } }).exec(),
  ]);
  return { customers, invoicesPerMonth, seats: members + invitations };
}

export async function planCodeOf(orgId: string): Promise<PlanCode> {
  const org = await Organization.findById(orgId, { plan: 1 }).lean().orFail().exec();
  return org.plan;
}

/**
 * Checks that one more `resource` fits the organisation's plan. Call inside the transaction that
 * creates it. The lock write makes concurrent creators conflict, so the count cannot be stale
 * by the time the insert commits (see touchLock: write skew).
 */
export async function checkCapacity(
  resource: LimitedResource,
  clock: Clock,
): Promise<UserError | undefined> {
  const orgId = requireOrgId();
  await touchLock(`capacity:${resource}`);
  const [plan, usage] = await Promise.all([planCodeOf(orgId), usageOf(clock)]);
  if (canAdd(plan, resource, usage[resource])) return undefined;
  const limit = String(PLANS[plan].limits[resource]);
  return {
    code: 'PLAN_LIMIT_REACHED',
    message: `The ${plan} plan allows ${limit} ${resource}. Upgrade to add more.`,
    field: [],
  };
}
