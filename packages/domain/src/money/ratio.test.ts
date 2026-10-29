import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { divideHalfEven, InvalidRatioError, ratio } from './ratio.ts';

describe('divideHalfEven', () => {
  it.each([
    [10n, 5n, 2n],
    [1n, 3n, 0n],
    [2n, 3n, 1n],
    [5n, 2n, 2n], // 2.5 → 2 (even)
    [7n, 2n, 4n], // 3.5 → 4 (even)
    [-5n, 2n, -2n], // -2.5 → -2
    [-7n, 2n, -4n], // -3.5 → -4
    [-1n, 3n, 0n],
    [-2n, 3n, -1n],
    [0n, 7n, 0n],
  ])('%i / %i = %i', (dividend, divisor, expected) => {
    expect(divideHalfEven(dividend, divisor)).toBe(expected);
  });

  it('rejects a non-positive divisor', () => {
    expect(() => divideHalfEven(1n, 0n)).toThrow(InvalidRatioError);
    expect(() => divideHalfEven(1n, -2n)).toThrow(InvalidRatioError);
  });

  it('is never more than half a unit away from the exact quotient', () => {
    fc.assert(
      fc.property(fc.bigInt(), fc.bigInt({ min: 1n, max: 10n ** 12n }), (dividend, divisor) => {
        const error = dividend - divideHalfEven(dividend, divisor) * divisor;
        const twiceError = 2n * (error < 0n ? -error : error);
        expect(twiceError <= divisor).toBe(true);
      }),
    );
  });

  it('is symmetric around zero', () => {
    fc.assert(
      fc.property(fc.bigInt(), fc.bigInt({ min: 1n, max: 10n ** 6n }), (dividend, divisor) => {
        expect(divideHalfEven(-dividend, divisor)).toBe(-divideHalfEven(dividend, divisor));
      }),
    );
  });
});

describe('ratio', () => {
  it('creates a frozen fraction', () => {
    const half = ratio(1n, 2n);
    expect(half).toEqual({ numerator: 1n, denominator: 2n });
    expect(Object.isFrozen(half)).toBe(true);
  });

  it('rejects a non-positive denominator', () => {
    expect(() => ratio(1n, 0n)).toThrow(InvalidRatioError);
    expect(() => ratio(1n, 0n)).toThrow(expect.objectContaining({ code: 'INVALID_RATIO' }));
  });
});
