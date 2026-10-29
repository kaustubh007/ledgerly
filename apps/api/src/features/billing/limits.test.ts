import { describe, expect, it } from 'vitest';
import { startOfMonthUtc } from './limits.ts';

describe('startOfMonthUtc', () => {
  it.each([
    ['2026-10-29T15:00:00Z', '2026-10-01T00:00:00.000Z'],
    ['2026-10-01T00:00:00Z', '2026-10-01T00:00:00.000Z'],
    ['2026-09-30T23:59:59.999Z', '2026-09-01T00:00:00.000Z'],
    ['2027-01-01T00:00:00Z', '2027-01-01T00:00:00.000Z'],
    ['2028-02-29T12:00:00Z', '2028-02-01T00:00:00.000Z'],
  ])('%s → %s', (now, expected) => {
    expect(startOfMonthUtc(new Date(now)).toISOString()).toBe(expected);
  });
});
