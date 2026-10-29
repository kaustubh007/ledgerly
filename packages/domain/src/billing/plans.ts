import { currency } from '../money/currency.ts';
import { Money } from '../money/money.ts';

export const PlanCode = { Free: 'FREE', Pro: 'PRO', Business: 'BUSINESS' } as const;
export type PlanCode = (typeof PlanCode)[keyof typeof PlanCode];

/** What a plan caps. `null` means unlimited. */
export interface PlanLimits {
  readonly customers: number | null;
  readonly invoicesPerMonth: number | null;
  /** Members plus open invitations: an invitation reserves a seat. */
  readonly seats: number | null;
}

export interface PlanFeatures {
  readonly customBranding: boolean;
  readonly mfaEnforcement: boolean;
  readonly auditExport: boolean;
}

export interface Plan {
  readonly code: PlanCode;
  readonly monthlyPrice: Money;
  readonly limits: PlanLimits;
  readonly features: PlanFeatures;
}

const USD = currency('USD');

/** The catalogue. Prices are what Ledgerly charges the organisation (through the simulator). */
export const PLANS: Readonly<Record<PlanCode, Plan>> = {
  FREE: {
    code: 'FREE',
    monthlyPrice: Money.zero(USD),
    limits: { customers: 5, invoicesPerMonth: 10, seats: 2 },
    features: { customBranding: false, mfaEnforcement: false, auditExport: false },
  },
  PRO: {
    code: 'PRO',
    monthlyPrice: Money.of(2900n, USD),
    limits: { customers: 500, invoicesPerMonth: 1000, seats: 10 },
    features: { customBranding: true, mfaEnforcement: false, auditExport: false },
  },
  BUSINESS: {
    code: 'BUSINESS',
    monthlyPrice: Money.of(9900n, USD),
    limits: { customers: null, invoicesPerMonth: null, seats: null },
    features: { customBranding: true, mfaEnforcement: true, auditExport: true },
  },
};

const ORDER: readonly PlanCode[] = ['FREE', 'PRO', 'BUSINESS'];

export function isPlanCode(value: string): value is PlanCode {
  return (ORDER as readonly string[]).includes(value);
}

export function planOf(code: PlanCode): Plan {
  return PLANS[code];
}

export type LimitedResource = keyof PlanLimits;

/**
 * Whether one more `resource` may be created when `current` already exist. Over-limit data is
 * never deleted (a downgrade leaves existing customers alone); creating more is what stops.
 */
export function canAdd(code: PlanCode, resource: LimitedResource, current: number): boolean {
  const limit = PLANS[code].limits[resource];
  return limit === null || current < limit;
}

export type PlanChange = 'UPGRADE' | 'DOWNGRADE' | 'SAME';

export function planChange(from: PlanCode, to: PlanCode): PlanChange {
  const diff = ORDER.indexOf(to) - ORDER.indexOf(from);
  if (diff === 0) return 'SAME';
  return diff > 0 ? 'UPGRADE' : 'DOWNGRADE';
}

/**
 * What to charge when changing plan. Upgrades charge the new plan's monthly price now (no
 * proration: kept simple on purpose, see DECISIONS.md); downgrades and no-ops charge nothing.
 */
export function chargeForChange(from: PlanCode, to: PlanCode): Money {
  return planChange(from, to) === 'UPGRADE' ? PLANS[to].monthlyPrice : Money.zero(USD);
}

/** Resources currently over the target plan's limits: shown before a downgrade, never enforced
 * by deleting anything. */
export function overLimitAfterChange(
  to: PlanCode,
  usage: Readonly<Record<LimitedResource, number>>,
): LimitedResource[] {
  return (Object.keys(usage) as LimitedResource[]).filter((resource) => {
    const limit = PLANS[to].limits[resource];
    return limit !== null && usage[resource] > limit;
  });
}
