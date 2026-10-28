import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { currency } from '../money/currency.ts';
import { Money } from '../money/money.ts';
import type { Result } from '../shared/result.ts';
import {
  allowedActions,
  balance,
  canPerform,
  createDraft,
  InvoiceAction,
  InvoiceStatus,
  recordPayment,
  replaceLines,
  send,
  voidInvoice,
  type Invoice,
  type InvoiceError,
} from './invoice.ts';
import type { LineItem } from './line-item.ts';
import { Quantity } from './quantity.ts';

const USD = currency('USD');
const EUR = currency('EUR');
const usd = (amount: string): Money => Money.parse(amount, USD);
const line = (unitPrice: Money, quantity = '1'): LineItem => ({
  description: 'Consulting',
  unitPrice,
  quantity: Quantity.parse(quantity),
});

function unwrap(result: Result<Invoice, InvoiceError>): Invoice {
  if (!result.ok) throw new Error(`Expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}

function errorOf(result: Result<Invoice, InvoiceError>): InvoiceError {
  if (result.ok) throw new Error('Expected an error');
  return result.error;
}

/** Builds an invoice of 100.00 USD in the requested status, through legal transitions only. */
function invoiceIn(status: InvoiceStatus): Invoice {
  const draft = unwrap(replaceLines(createDraft(USD), [line(usd('100.00'))]));
  switch (status) {
    case 'DRAFT':
      return draft;
    case 'SENT':
      return unwrap(send(draft));
    case 'PARTIALLY_PAID':
      return unwrap(recordPayment(unwrap(send(draft)), usd('40.00')));
    case 'PAID':
      return unwrap(recordPayment(unwrap(send(draft)), usd('100.00')));
    case 'VOID':
      return unwrap(voidInvoice(draft));
  }
}

const attempt: Record<InvoiceAction, (invoice: Invoice) => Result<Invoice, InvoiceError>> = {
  EDIT_LINES: (invoice) => replaceLines(invoice, [line(usd('5.00'))]),
  SEND: send,
  RECORD_PAYMENT: (invoice) => recordPayment(invoice, usd('1.00')),
  VOID: voidInvoice,
};

const statuses = Object.values(InvoiceStatus);
const actions = Object.values(InvoiceAction);

describe('invoice state machine', () => {
  it('matches the documented transition table exactly', () => {
    expect(Object.fromEntries(statuses.map((s) => [s, allowedActions(s)]))).toEqual({
      DRAFT: ['EDIT_LINES', 'SEND', 'VOID'],
      SENT: ['RECORD_PAYMENT', 'VOID'],
      PARTIALLY_PAID: ['RECORD_PAYMENT'],
      PAID: [],
      VOID: [],
    });
  });

  // Every status × every action: 25 cases. The function must agree with the table, and a
  // refused action must say which status and action were refused.
  describe.each(statuses)('from %s', (status) => {
    it.each(actions)('%s', (action) => {
      const result = attempt[action](invoiceIn(status));
      if (canPerform(status, action)) {
        expect(result.ok).toBe(true);
      } else {
        expect(errorOf(result)).toEqual({ code: 'INVALID_TRANSITION', status, action });
      }
    });
  });
});

describe('createDraft', () => {
  it('starts empty, at zero, in the given currency, and frozen', () => {
    const draft = createDraft(EUR);
    expect(draft.status).toBe('DRAFT');
    expect(draft.lines).toEqual([]);
    expect(draft.total.equals(Money.zero(EUR))).toBe(true);
    expect(draft.paid.equals(Money.zero(EUR))).toBe(true);
    expect(Object.isFrozen(draft)).toBe(true);
    expect(Object.isFrozen(draft.lines)).toBe(true);
  });
});

describe('replaceLines', () => {
  it('recomputes the total from rounded line totals', () => {
    const invoice = unwrap(
      replaceLines(createDraft(USD), [line(usd('10.00'), '0.333'), line(usd('0.05'), '0.5')]),
    );
    expect(invoice.total.toDecimalString()).toBe('3.35'); // 3.33 + 0.02
  });

  it('does not keep a reference to the caller’s array', () => {
    const lines = [line(usd('1.00'))];
    const invoice = unwrap(replaceLines(createDraft(USD), lines));
    lines.push(line(usd('2.00')));
    expect(invoice.lines).toHaveLength(1);
  });

  it('rejects a line in another currency', () => {
    expect(errorOf(replaceLines(createDraft(USD), [line(Money.parse('1', EUR))]))).toEqual({
      code: 'CURRENCY_MISMATCH',
      expected: 'USD',
      actual: 'EUR',
    });
  });

  it('rejects a negative unit price and says which line', () => {
    expect(errorOf(replaceLines(createDraft(USD), [line(usd('1')), line(usd('-1'))]))).toEqual({
      code: 'NEGATIVE_UNIT_PRICE',
      lineIndex: 1,
    });
  });

  it('allows a zero-priced line', () => {
    expect(replaceLines(createDraft(USD), [line(usd('0'))]).ok).toBe(true);
  });
});

describe('send', () => {
  it('refuses an invoice with nothing to pay', () => {
    expect(errorOf(send(createDraft(USD)))).toEqual({ code: 'EMPTY_INVOICE' });
    const zero = unwrap(replaceLines(createDraft(USD), [line(usd('0'))]));
    expect(errorOf(send(zero))).toEqual({ code: 'EMPTY_INVOICE' });
  });

  it('does not change the original invoice', () => {
    const draft = invoiceIn('DRAFT');
    unwrap(send(draft));
    expect(draft.status).toBe('DRAFT');
  });
});

describe('recordPayment', () => {
  const sent = invoiceIn('SENT');

  it('moves to PARTIALLY_PAID, then PAID when the balance reaches zero', () => {
    const partly = unwrap(recordPayment(sent, usd('30.00')));
    expect(partly.status).toBe('PARTIALLY_PAID');
    expect(balance(partly).toDecimalString()).toBe('70.00');

    const paid = unwrap(recordPayment(partly, usd('70.00')));
    expect(paid.status).toBe('PAID');
    expect(balance(paid).isZero()).toBe(true);
  });

  it('rejects overpayment and reports the balance', () => {
    const partly = unwrap(recordPayment(sent, usd('30.00')));
    const error = errorOf(recordPayment(partly, usd('70.01')));
    expect(error.code).toBe('OVERPAYMENT');
    expect(error).toHaveProperty('balance', usd('70.00'));
  });

  it('rejects zero and negative amounts', () => {
    expect(errorOf(recordPayment(sent, usd('0')))).toEqual({ code: 'NON_POSITIVE_AMOUNT' });
    expect(errorOf(recordPayment(sent, usd('-1')))).toEqual({ code: 'NON_POSITIVE_AMOUNT' });
  });

  it('rejects a payment in another currency without converting it', () => {
    expect(errorOf(recordPayment(sent, Money.parse('10', EUR)))).toEqual({
      code: 'CURRENCY_MISMATCH',
      expected: 'USD',
      actual: 'EUR',
    });
  });

  it('never lets paid exceed total, whatever sequence of payments is attempted', () => {
    fc.assert(
      fc.property(fc.array(fc.bigInt({ min: -500n, max: 6000n }), { maxLength: 30 }), (amounts) => {
        let invoice = sent;
        for (const amount of amounts) {
          const result = recordPayment(invoice, Money.of(amount, USD));
          if (result.ok) invoice = result.value;
        }
        expect(invoice.paid.compare(invoice.total)).toBeLessThanOrEqual(0);
        expect(invoice.paid.isNegative()).toBe(false);
        expect(invoice.status === 'PAID').toBe(invoice.paid.equals(invoice.total));
      }),
    );
  });
});
