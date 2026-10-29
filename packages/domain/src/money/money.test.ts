import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { currency } from './currency.ts';
import {
  CurrencyMismatchError,
  InvalidMoneyFormatError,
  Money,
  MoneyOverflowError,
  sum,
} from './money.ts';
import { ratio } from './ratio.ts';

const USD = currency('USD');
const EUR = currency('EUR');
const JPY = currency('JPY');
const KWD = currency('KWD');
const INT64_MAX = 2n ** 63n - 1n;
const INT64_MIN = -(2n ** 63n);

const usd = (input: string): Money => Money.parse(input, USD);
const anyUsd = fc.bigInt({ min: -(10n ** 15n), max: 10n ** 15n }).map((n) => Money.of(n, USD));

describe('Money construction', () => {
  it('accepts the full int64 range and nothing beyond it', () => {
    expect(Money.of(INT64_MAX, USD).amountMinor).toBe(INT64_MAX);
    expect(Money.of(INT64_MIN, USD).amountMinor).toBe(INT64_MIN);
    expect(() => Money.of(INT64_MAX + 1n, USD)).toThrow(MoneyOverflowError);
    expect(() => Money.of(INT64_MIN - 1n, USD)).toThrow(MoneyOverflowError);
  });

  it('is immutable', () => {
    const m = usd('1.00');
    expect(Object.isFrozen(m)).toBe(true);
  });

  it('has a zero', () => {
    expect(Money.zero(EUR).isZero()).toBe(true);
    expect(Money.zero(EUR).currency).toBe(EUR);
  });
});

describe('Money.parse', () => {
  it.each([
    ['12.30', USD, 1230n],
    ['12.3', USD, 1230n],
    ['12', USD, 1200n],
    ['-0.05', USD, -5n],
    ['0', USD, 0n],
    ['1500', JPY, 1500n],
    ['1.234', KWD, 1234n],
  ])('%s %s → %i minor units', (input, c, expected) => {
    expect(Money.parse(input, c).amountMinor).toBe(expected);
  });

  it('refuses more precision than the currency has instead of rounding', () => {
    expect(() => Money.parse('1.005', USD)).toThrow(InvalidMoneyFormatError);
    expect(() => Money.parse('1.5', JPY)).toThrow(/JPY has 0 decimal places/);
  });

  it.each(['', '1,00', '1.', '.5', '+1', '1e3', ' 1', 'NaN', '--1'])('rejects %j', (input) => {
    expect(() => usd(input)).toThrow(InvalidMoneyFormatError);
  });

  it('round-trips through toDecimalString', () => {
    fc.assert(
      fc.property(anyUsd, (m) => {
        expect(usd(m.toDecimalString()).equals(m)).toBe(true);
      }),
    );
  });
});

describe('Money JSON', () => {
  it('serialises the amount as a string so int64 survives JSON', () => {
    const m = Money.of(INT64_MAX, USD);
    expect(JSON.parse(JSON.stringify(m))).toEqual({
      amountMinor: '9223372036854775807',
      currency: 'USD',
    });
  });

  it('round-trips', () => {
    fc.assert(
      fc.property(anyUsd, (m) => {
        expect(Money.fromJSON(m.toJSON()).equals(m)).toBe(true);
      }),
    );
  });

  it('rejects malformed input', () => {
    expect(() => Money.fromJSON({ amountMinor: '1.5', currency: 'USD' })).toThrow(
      InvalidMoneyFormatError,
    );
    expect(() => Money.fromJSON({ amountMinor: '1', currency: 'BTC' })).toThrow(
      /Unsupported currency/,
    );
  });
});

describe('Money arithmetic', () => {
  it('adds and subtracts', () => {
    expect(usd('1.10').add(usd('2.25')).equals(usd('3.35'))).toBe(true);
    expect(usd('1.10').subtract(usd('2.25')).equals(usd('-1.15'))).toBe(true);
    expect(usd('1.10').negate().equals(usd('-1.10'))).toBe(true);
  });

  it('throws CurrencyMismatchError when currencies differ', () => {
    const eur = Money.parse('1', EUR);
    expect(() => usd('1').add(eur)).toThrow(CurrencyMismatchError);
    expect(() => usd('1').subtract(eur)).toThrow(CurrencyMismatchError);
    expect(() => usd('1').compare(eur)).toThrow(CurrencyMismatchError);
    try {
      usd('1').add(eur);
    } catch (error) {
      expect(error).toMatchObject({ code: 'CURRENCY_MISMATCH', expected: 'USD', actual: 'EUR' });
    }
  });

  it('throws on overflow rather than wrapping or saturating', () => {
    const max = Money.of(INT64_MAX, USD);
    const min = Money.of(INT64_MIN, USD);
    expect(() => max.add(Money.of(1n, USD))).toThrow(MoneyOverflowError);
    expect(() => min.subtract(Money.of(1n, USD))).toThrow(MoneyOverflowError);
    expect(() => min.negate()).toThrow(MoneyOverflowError);
    expect(() => max.multiplyAndRound(ratio(2n, 1n))).toThrow(MoneyOverflowError);
  });

  it('addition is commutative and associative; subtraction undoes it', () => {
    fc.assert(
      fc.property(anyUsd, anyUsd, anyUsd, (a, b, c) => {
        expect(a.add(b).equals(b.add(a))).toBe(true);
        expect(
          a
            .add(b)
            .add(c)
            .equals(a.add(b.add(c))),
        ).toBe(true);
        expect(a.add(b).subtract(b).equals(a)).toBe(true);
      }),
    );
  });
});

describe('Money.multiplyAndRound', () => {
  it.each([
    ['10.05', 1n, 2n, '5.02'], // 5.025 → 5.02 (2 is even)
    ['10.15', 1n, 2n, '5.08'], // 5.075 → 5.08 (8 is even)
    ['-10.05', 1n, 2n, '-5.02'],
    ['19.99', 3n, 1n, '59.97'],
    ['10.00', 1n, 3n, '3.33'],
    ['10.00', 2n, 3n, '6.67'],
  ])('%s × %i/%i = %s', (amount, numerator, denominator, expected) => {
    expect(usd(amount).multiplyAndRound(ratio(numerator, denominator)).toDecimalString()).toBe(
      expected,
    );
  });

  it('keeps the currency', () => {
    expect(Money.parse('100', JPY).multiplyAndRound(ratio(1n, 3n)).currency).toBe(JPY);
  });
});

describe('Money comparison', () => {
  it('compares', () => {
    expect(usd('1').compare(usd('2'))).toBe(-1);
    expect(usd('2').compare(usd('1'))).toBe(1);
    expect(usd('2').compare(usd('2.00'))).toBe(0);
  });

  it('treats different currencies as unequal instead of throwing', () => {
    expect(usd('1').equals(Money.parse('1', EUR))).toBe(false);
    expect(usd('1').equals(usd('1.00'))).toBe(true);
    expect(usd('1').equals(usd('1.01'))).toBe(false);
  });

  it('knows its sign', () => {
    expect([usd('0').isZero(), usd('0').isPositive(), usd('0').isNegative()]).toEqual([
      true,
      false,
      false,
    ]);
    expect([usd('1').isZero(), usd('1').isPositive(), usd('1').isNegative()]).toEqual([
      false,
      true,
      false,
    ]);
    expect([usd('-1').isZero(), usd('-1').isPositive(), usd('-1').isNegative()]).toEqual([
      false,
      false,
      true,
    ]);
  });
});

describe('Money formatting', () => {
  it.each([
    [0n, USD, '0.00'],
    [5n, USD, '0.05'],
    [-5n, USD, '-0.05'],
    [123456n, USD, '1234.56'],
    [1234n, JPY, '1234'],
    [-3n, JPY, '-3'],
    [1n, KWD, '0.001'],
  ])('%i %s → %s', (amountMinor, c, expected) => {
    expect(Money.of(amountMinor, c).toDecimalString()).toBe(expected);
  });

  it('has a readable toString', () => {
    expect(usd('-12.3').toString()).toBe('-12.30 USD');
  });

  it('formats exactly with Intl, without going through a float', () => {
    const big = Money.of(900719925474099312n, USD); // well beyond Number.MAX_SAFE_INTEGER
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
      // Intl accepts decimal strings; the cast is only because lib typings say number|bigint.
      .format(big.toDecimalString() as unknown as number);
    expect(formatted).toBe('$9,007,199,254,740,993.12');
  });
});

describe('sum', () => {
  it('sums to zero for an empty list', () => {
    expect(sum(USD, []).equals(Money.zero(USD))).toBe(true);
  });

  it('sums amounts of one currency', () => {
    expect(sum(USD, [usd('1.10'), usd('2.20'), usd('-0.30')]).equals(usd('3.00'))).toBe(true);
  });

  it('refuses to sum across currencies', () => {
    expect(() => sum(USD, [usd('1'), Money.parse('1', EUR)])).toThrow(CurrencyMismatchError);
    expect(() => sum(EUR, [usd('1')])).toThrow(CurrencyMismatchError);
  });
});
