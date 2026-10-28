import type { Currency } from '../money/currency.ts';
import { Money, sum } from '../money/money.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { lineTotal, type LineItem } from './line-item.ts';

export const InvoiceStatus = {
  Draft: 'DRAFT',
  Sent: 'SENT',
  PartiallyPaid: 'PARTIALLY_PAID',
  Paid: 'PAID',
  Void: 'VOID',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const InvoiceAction = {
  EditLines: 'EDIT_LINES',
  Send: 'SEND',
  RecordPayment: 'RECORD_PAYMENT',
  Void: 'VOID',
} as const;
export type InvoiceAction = (typeof InvoiceAction)[keyof typeof InvoiceAction];

/**
 * The whole state machine in one table. Every function below checks it first, so the table
 * is the single place to read (and test) which action is legal in which status.
 */
const ALLOWED: Readonly<Record<InvoiceStatus, readonly InvoiceAction[]>> = {
  DRAFT: ['EDIT_LINES', 'SEND', 'VOID'],
  SENT: ['RECORD_PAYMENT', 'VOID'],
  PARTIALLY_PAID: ['RECORD_PAYMENT'],
  PAID: [],
  VOID: [],
};

export function allowedActions(status: InvoiceStatus): readonly InvoiceAction[] {
  return ALLOWED[status];
}

export function canPerform(status: InvoiceStatus, action: InvoiceAction): boolean {
  return ALLOWED[status].includes(action);
}

/**
 * The money-relevant state of an invoice. Identity, numbering, customer and dates belong to
 * the application layer; the domain only decides what is legal and what the amounts become.
 */
export interface Invoice {
  readonly status: InvoiceStatus;
  readonly currency: Currency;
  readonly lines: readonly LineItem[];
  readonly total: Money;
  readonly paid: Money;
}

export type InvoiceError =
  | {
      readonly code: 'INVALID_TRANSITION';
      readonly status: InvoiceStatus;
      readonly action: InvoiceAction;
    }
  | { readonly code: 'CURRENCY_MISMATCH'; readonly expected: string; readonly actual: string }
  | { readonly code: 'NEGATIVE_UNIT_PRICE'; readonly lineIndex: number }
  | { readonly code: 'EMPTY_INVOICE' }
  | { readonly code: 'NON_POSITIVE_AMOUNT' }
  | { readonly code: 'OVERPAYMENT'; readonly balance: Money };

export type InvoiceResult = Result<Invoice, InvoiceError>;

export function createDraft(currency: Currency): Invoice {
  return freeze({
    status: 'DRAFT',
    currency,
    lines: [],
    total: Money.zero(currency),
    paid: Money.zero(currency),
  });
}

export function balance(invoice: Invoice): Money {
  return invoice.total.subtract(invoice.paid);
}

export function replaceLines(invoice: Invoice, lines: readonly LineItem[]): InvoiceResult {
  const denied = guard(invoice, 'EDIT_LINES');
  if (denied) return denied;

  for (const [lineIndex, line] of lines.entries()) {
    if (line.unitPrice.currency.code !== invoice.currency.code) {
      return currencyMismatch(invoice.currency, line.unitPrice.currency);
    }
    if (line.unitPrice.isNegative()) return err({ code: 'NEGATIVE_UNIT_PRICE', lineIndex });
  }

  return ok(
    freeze({
      ...invoice,
      lines: [...lines],
      total: sum(invoice.currency, lines.map(lineTotal)),
    }),
  );
}

export function send(invoice: Invoice): InvoiceResult {
  const denied = guard(invoice, 'SEND');
  if (denied) return denied;
  if (!invoice.total.isPositive()) return err({ code: 'EMPTY_INVOICE' });
  return ok(freeze({ ...invoice, status: 'SENT' }));
}

/**
 * Applies a payment. This decides *whether* the payment is legal given the invoice as read;
 * making the read-check-write atomic against concurrent payments is the application layer's
 * job (a MongoDB transaction, ADR-0002).
 */
export function recordPayment(invoice: Invoice, amount: Money): InvoiceResult {
  const denied = guard(invoice, 'RECORD_PAYMENT');
  if (denied) return denied;
  if (amount.currency.code !== invoice.currency.code) {
    return currencyMismatch(invoice.currency, amount.currency);
  }
  if (!amount.isPositive()) return err({ code: 'NON_POSITIVE_AMOUNT' });

  const remaining = balance(invoice);
  if (amount.compare(remaining) > 0) return err({ code: 'OVERPAYMENT', balance: remaining });

  const paid = invoice.paid.add(amount);
  const status = paid.equals(invoice.total) ? 'PAID' : 'PARTIALLY_PAID';
  return ok(freeze({ ...invoice, paid, status }));
}

export function voidInvoice(invoice: Invoice): InvoiceResult {
  const denied = guard(invoice, 'VOID');
  if (denied) return denied;
  return ok(freeze({ ...invoice, status: 'VOID' }));
}

function guard(invoice: Invoice, action: InvoiceAction): Result<never, InvoiceError> | undefined {
  if (canPerform(invoice.status, action)) return undefined;
  return err({ code: 'INVALID_TRANSITION', status: invoice.status, action });
}

function currencyMismatch(expected: Currency, actual: Currency): Result<never, InvoiceError> {
  return err({ code: 'CURRENCY_MISMATCH', expected: expected.code, actual: actual.code });
}

function freeze(invoice: Invoice): Invoice {
  Object.freeze(invoice.lines);
  return Object.freeze(invoice);
}
