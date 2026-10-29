import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canAdd,
  chargeForChange,
  isPlanCode,
  overLimitAfterChange,
  PlanCode,
  planChange,
  planOf,
  PLANS,
} from './plans.ts';

const codes = Object.values(PlanCode);

describe('plan catalogue', () => {
  it('prices plans in USD minor units', () => {
    expect(PLANS.FREE.monthlyPrice.toString()).toBe('0.00 USD');
    expect(PLANS.PRO.monthlyPrice.toString()).toBe('29.00 USD');
    expect(planOf('BUSINESS').monthlyPrice.toString()).toBe('99.00 USD');
  });

  it('only ever grows limits and features from plan to plan', () => {
    const ladder = ['FREE', 'PRO', 'BUSINESS'] as const;
    for (const [i, lower] of ladder.entries()) {
      for (const higher of ladder.slice(i + 1)) {
        for (const [resource, limit] of Object.entries(PLANS[lower].limits)) {
          const higherLimit = PLANS[higher].limits[resource as keyof typeof PLANS.FREE.limits];
          if (limit !== null) expect(higherLimit === null || higherLimit >= limit).toBe(true);
          else expect(higherLimit).toBeNull();
        }
        for (const [feature, on] of Object.entries(PLANS[lower].features)) {
          if (on)
            expect(PLANS[higher].features[feature as keyof typeof PLANS.FREE.features]).toBe(true);
        }
      }
    }
  });

  it('recognises plan codes', () => {
    expect(isPlanCode('PRO')).toBe(true);
    expect(isPlanCode('pro')).toBe(false);
  });
});

describe('canAdd', () => {
  it('allows up to the limit and refuses beyond', () => {
    expect(canAdd('FREE', 'customers', 4)).toBe(true);
    expect(canAdd('FREE', 'customers', 5)).toBe(false);
    expect(canAdd('FREE', 'seats', 1)).toBe(true);
    expect(canAdd('FREE', 'seats', 2)).toBe(false);
  });

  it('never refuses on an unlimited plan', () => {
    fc.assert(fc.property(fc.nat(), (n) => canAdd('BUSINESS', 'invoicesPerMonth', n)));
  });
});

describe('plan changes', () => {
  it.each([
    ['FREE', 'PRO', 'UPGRADE', '29.00'],
    ['PRO', 'BUSINESS', 'UPGRADE', '99.00'],
    ['BUSINESS', 'FREE', 'DOWNGRADE', '0.00'],
    ['PRO', 'PRO', 'SAME', '0.00'],
  ] as const)('%s → %s is %s and charges %s', (from, to, kind, charge) => {
    expect(planChange(from, to)).toBe(kind);
    expect(chargeForChange(from, to).toDecimalString()).toBe(charge);
  });

  it('lists what would be over the limit after a downgrade, deleting nothing', () => {
    expect(overLimitAfterChange('FREE', { customers: 7, invoicesPerMonth: 10, seats: 1 })).toEqual([
      'customers',
    ]);
    expect(
      overLimitAfterChange('BUSINESS', { customers: 1e6, invoicesPerMonth: 1e6, seats: 1e6 }),
    ).toEqual([]);
  });

  it('charges for every upgrade and only for upgrades', () => {
    fc.assert(
      fc.property(fc.constantFrom(...codes), fc.constantFrom(...codes), (from, to) => {
        expect(chargeForChange(from, to).isPositive()).toBe(planChange(from, to) === 'UPGRADE');
      }),
    );
  });
});
