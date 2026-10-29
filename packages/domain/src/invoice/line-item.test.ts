import { describe, expect, it } from 'vitest';
import { currency } from '../money/currency.ts';
import { Money } from '../money/money.ts';
import { lineTotal } from './line-item.ts';
import { Quantity } from './quantity.ts';

const USD = currency('USD');
const line = (unitPrice: string, quantity: string) => ({
  description: 'x',
  unitPrice: Money.parse(unitPrice, USD),
  quantity: Quantity.parse(quantity),
});

describe('lineTotal', () => {
  it.each([
    ['19.99', '3', '59.97'],
    ['10.00', '0.333', '3.33'],
    ['0.05', '0.5', '0.02'], // 0.025 → 0.02, half-to-even
    ['0.07', '0.5', '0.04'], // 0.035 → 0.04, half-to-even
    ['120.00', '1.25', '150.00'],
  ])('%s × %s = %s', (unitPrice, quantity, expected) => {
    expect(lineTotal(line(unitPrice, quantity)).toDecimalString()).toBe(expected);
  });
});
