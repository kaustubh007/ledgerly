import { describe, expect, it } from 'vitest';
import {
  currency,
  isSupportedCurrency,
  supportedCurrencies,
  UnknownCurrencyError,
} from './currency.ts';

describe('currency', () => {
  it('returns the same frozen instance for the same code', () => {
    expect(currency('USD')).toBe(currency('USD'));
    expect(Object.isFrozen(currency('USD'))).toBe(true);
  });

  it.each([
    ['USD', 2],
    ['JPY', 0],
    ['KRW', 0],
    ['KWD', 3],
    ['BHD', 3],
  ])('%s has %i minor units', (code, minorUnits) => {
    expect(currency(code).minorUnits).toBe(minorUnits);
  });

  it('rejects unknown and wrongly cased codes', () => {
    expect(() => currency('XXX')).toThrow(UnknownCurrencyError);
    expect(() => currency('usd')).toThrow(UnknownCurrencyError);
    try {
      currency('ZZZ');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'UnknownCurrencyError',
        code: 'UNKNOWN_CURRENCY',
        currencyCode: 'ZZZ',
      });
    }
  });

  it('reports support without throwing', () => {
    expect(isSupportedCurrency('EUR')).toBe(true);
    expect(isSupportedCurrency('BTC')).toBe(false);
  });

  it('lists every supported currency once', () => {
    const codes = supportedCurrencies().map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('INR');
  });
});
