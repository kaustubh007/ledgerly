import type { Money } from '@ledgerly/domain';
import { currency, type Invoice as DomainInvoice, type LineItem } from '@ledgerly/domain';
import { lineItem, money } from '../../graphql/money.ts';
import type { InvoiceRecord } from './invoice.model.ts';

// The one place where stored invoices and domain invoices are translated. Amounts stay bigint
// all the way through.

export function linesOf(record: InvoiceRecord): LineItem[] {
  return record.lines.map((l) =>
    lineItem(l.description, l.quantityThousandths, l.unitPriceMinor, record.currency),
  );
}

export function toDomain(record: InvoiceRecord): DomainInvoice {
  return {
    status: record.status,
    currency: currency(record.currency),
    lines: linesOf(record),
    total: money(record.totalMinor, record.currency),
    paid: money(record.paidMinor, record.currency),
  };
}

/** Fields to `$set` after a domain operation. */
export function fromDomain(invoice: DomainInvoice) {
  return {
    status: invoice.status,
    lines: invoice.lines.map((l) => ({
      description: l.description,
      quantityThousandths: l.quantity.thousandths,
      unitPriceMinor: l.unitPrice.amountMinor,
    })),
    totalMinor: invoice.total.amountMinor,
    paidMinor: invoice.paid.amountMinor,
  };
}

export function balanceOf(record: InvoiceRecord): Money {
  return money(record.totalMinor - record.paidMinor, record.currency);
}
