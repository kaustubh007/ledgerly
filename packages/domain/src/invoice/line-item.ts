import type { Money } from '../money/money.ts';
import type { Quantity } from './quantity.ts';

export interface LineItem {
  readonly description: string;
  readonly quantity: Quantity;
  readonly unitPrice: Money;
}

/** Unit price × quantity, rounded once, half-to-even. Each line is rounded on its own. */
export function lineTotal(line: LineItem): Money {
  return line.unitPrice.multiplyAndRound(line.quantity.asRatio());
}
