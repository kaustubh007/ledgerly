import { describe, expect, it } from 'vitest';
import { InvalidQuantityError, Quantity } from './quantity.ts';

describe('Quantity', () => {
  it.each([
    ['1', 1000n, '1'],
    ['1.5', 1500n, '1.5'],
    ['0.125', 125n, '0.125'],
    ['2.10', 2100n, '2.1'],
    ['0.001', 1n, '0.001'],
  ])('parses %s as %i thousandths and prints %s', (input, thousandths, printed) => {
    const quantity = Quantity.parse(input);
    expect(quantity.thousandths).toBe(thousandths);
    expect(quantity.toDecimalString()).toBe(printed);
  });

  it.each(['0', '0.000', '-1', '1.2345', '1.', '.5', '', 'one', '1e3'])('rejects %j', (input) => {
    expect(() => Quantity.parse(input)).toThrow(InvalidQuantityError);
  });

  it('rejects absurdly large quantities', () => {
    expect(() => Quantity.parse('1000000000')).not.toThrow();
    expect(() => Quantity.parse('1000000000.001')).toThrow(/too large/);
  });

  it('builds from thousandths and exposes an exact ratio', () => {
    const quantity = Quantity.ofThousandths(2500n);
    expect(quantity.asRatio()).toEqual({ numerator: 2500n, denominator: 1000n });
    expect(() => Quantity.ofThousandths(0n)).toThrow(
      expect.objectContaining({ code: 'INVALID_QUANTITY' }),
    );
    expect(Object.isFrozen(quantity)).toBe(true);
  });
});
