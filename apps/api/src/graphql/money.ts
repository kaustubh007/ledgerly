import { currency, lineTotal, Money, Quantity, type LineItem } from '@ledgerly/domain';
import type { MoneyResolvers, InvoiceLineResolvers } from './__generated__/resolvers.ts';

export const moneyResolvers: MoneyResolvers = {
  amountMinor: (money) => money.amountMinor,
  currency: (money) => money.currency.code,
  amount: (money) => money.toDecimalString(),
};

export const invoiceLineResolvers: InvoiceLineResolvers = {
  description: (line) => line.description,
  quantity: (line) => line.quantity.toDecimalString(),
  unitPrice: (line) => line.unitPrice,
  total: (line) => lineTotal(line),
};

export function money(amountMinor: bigint, code: string): Money {
  return Money.of(amountMinor, currency(code));
}

export function lineItem(
  description: string,
  quantityThousandths: bigint,
  unitPriceMinor: bigint,
  code: string,
): LineItem {
  return {
    description,
    quantity: Quantity.ofThousandths(quantityThousandths),
    unitPrice: money(unitPriceMinor, code),
  };
}
