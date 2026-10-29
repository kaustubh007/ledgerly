import { Types } from 'mongoose';
import {
  createDraft,
  currency,
  InvalidMoneyFormatError,
  Money,
  Quantity,
  recordPayment as recordDomainPayment,
  replaceLines as replaceDomainLines,
  send as sendDomainInvoice,
  voidInvoice as voidDomainInvoice,
  type InvoiceError,
  type InvoiceResult,
  type LineItem,
} from '@ledgerly/domain';
import {
  CardPaymentInput,
  CreateInvoiceInput,
  InvoiceLines,
  parseInput,
  RecordPaymentInput,
  type UserError,
} from '@ledgerly/validation';
import type { Clock } from '../../clock.ts';
import { inTransaction } from '../../data/connection.ts';
import { objectId } from '../../graphql/ids.ts';
import { Customer } from '../customers/customer.model.ts';
import type { Deps } from '../../deps.ts';
import { checkCapacity } from '../billing/limits.ts';
import { idempotent, storedOutcome, type Outcome } from '../idempotency/idempotency.ts';
import { declineMessage, gatewayKey } from '../payments/gateway.ts';
import { enqueueEmail } from '../outbox/outbox.ts';
import { nextSequence } from './counter.model.ts';
import { fromDomain, toDomain } from './invoice.mapper.ts';
import { Invoice } from './invoice.model.ts';
import { Payment } from './payment.model.ts';

const MESSAGES: Record<InvoiceError['code'], string> = {
  INVALID_TRANSITION: 'This invoice cannot do that in its current status.',
  CURRENCY_MISMATCH: 'The amount must be in the invoice currency.',
  NEGATIVE_UNIT_PRICE: 'Unit prices cannot be negative.',
  EMPTY_INVOICE: 'An invoice needs a positive total before it can be sent.',
  NON_POSITIVE_AMOUNT: 'The amount must be greater than zero.',
  OVERPAYMENT: 'The amount is more than the balance due.',
};

const refused = (userErrors: UserError[]): Outcome => ({ ok: false, userErrors });
const notFound = (field: string[]): Outcome =>
  refused([{ code: 'NOT_FOUND', message: 'No such invoice.', field }]);

function domainError(error: InvoiceError, field: string[]): UserError[] {
  const fieldFor =
    error.code === 'NEGATIVE_UNIT_PRICE' ? ['lines', String(error.lineIndex), 'unitPrice'] : field;
  return [{ code: error.code, message: MESSAGES[error.code], field: fieldFor }];
}

/** Parses validated line inputs into domain line items in `currencyCode`. */
function toLineItems(
  lines: readonly { description: string; quantity: string; unitPrice: string }[],
  currencyCode: string,
  prefix: string[],
): { ok: true; lines: LineItem[] } | { ok: false; userErrors: UserError[] } {
  const c = currency(currencyCode);
  const items: LineItem[] = [];
  for (const [i, line] of lines.entries()) {
    try {
      items.push({
        description: line.description,
        quantity: Quantity.parse(line.quantity),
        unitPrice: Money.parse(line.unitPrice, c),
      });
    } catch (error) {
      // The regexes in @ledgerly/validation already passed; what is left is precision
      // ("1.005" in USD) or range, which only the domain knows.
      const code = error instanceof InvalidMoneyFormatError ? 'INVALID_AMOUNT' : 'INVALID_QUANTITY';
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, userErrors: [{ code, message, field: [...prefix, String(i)] }] };
    }
  }
  return { ok: true, lines: items };
}

async function persist(
  id: Types.ObjectId,
  result: InvoiceResult,
  field: string[],
  extra: Record<string, unknown> = {},
): Promise<Outcome> {
  if (!result.ok) return refused(domainError(result.error, field));
  await Invoice.updateOne({ _id: id }, { $set: { ...fromDomain(result.value), ...extra } });
  return { ok: true, id: id.toString() };
}

/** Call inside `idempotent()`, which supplies the transaction (the plan limit needs it). */
export async function createInvoice(rawInput: unknown, clock: Clock): Promise<Outcome> {
  const parsed = parseInput(CreateInvoiceInput, rawInput);
  if (!parsed.ok) return refused(parsed.userErrors);
  const input = parsed.value;

  const customerId = objectId(input.customerId);
  // Tenant-guarded: another organisation's customer is "not found", not "forbidden".
  if (!customerId || !(await Customer.exists({ _id: customerId }))) {
    return refused([
      { code: 'NOT_FOUND', message: 'No such customer.', field: ['input', 'customerId'] },
    ]);
  }
  const items = toLineItems(input.lines, input.currency, ['input', 'lines']);
  if (!items.ok) return refused(items.userErrors);

  const result = replaceDomainLines(createDraft(currency(input.currency)), items.lines);
  if (!result.ok) return refused(domainError(result.error, ['input', 'lines']));
  const overLimit = await checkCapacity('invoicesPerMonth', clock);
  if (overLimit) return refused([overLimit]);
  const [invoice] = await Invoice.create([
    { customerId, currency: input.currency, dueDate: input.dueDate, ...fromDomain(result.value) },
  ]);
  if (!invoice) throw new Error('Invoice.create returned nothing.');
  return { ok: true, id: invoice._id.toString() };
}

export async function replaceLines(id: string, rawLines: unknown): Promise<Outcome> {
  const parsed = parseInput(InvoiceLines, rawLines, ['lines']);
  if (!parsed.ok) return refused(parsed.userErrors);
  const _id = objectId(id);
  if (!_id) return notFound(['id']);
  return inTransaction(async () => {
    const record = await Invoice.findById(_id).lean().exec();
    if (!record) return notFound(['id']);
    const items = toLineItems(parsed.value, record.currency, ['lines']);
    if (!items.ok) return refused(items.userErrors);
    return persist(_id, replaceDomainLines(toDomain(record), items.lines), ['lines']);
  });
}

/** Call inside `idempotent()`, which supplies the transaction. */
export async function sendInvoice(
  id: string,
  publicOrigin: string,
  clock: Clock,
): Promise<Outcome> {
  const _id = objectId(id);
  if (!_id) return notFound(['id']);
  const record = await Invoice.findById(_id).lean().exec();
  if (!record) return notFound(['id']);
  const result = sendDomainInvoice(toDomain(record));
  if (!result.ok) return refused(domainError(result.error, ['id']));

  // In the same transaction as the status change: if anything below fails, the number is not
  // consumed (ADR-0002).
  const now = clock.now();
  const seq = await nextSequence('invoice');
  const number = `INV-${String(now.getUTCFullYear())}-${String(seq).padStart(5, '0')}`;
  const customer = await Customer.findById(record.customerId, { email: 1, name: 1 }).lean().exec();
  if (customer?.email) {
    await enqueueEmail('invoice-sent', customer.email, {
      number,
      customer: customer.name,
      link: `${publicOrigin}/invoices/${id}`,
    });
  }
  return persist(_id, result, ['id'], { number, sentAt: now });
}

/**
 * Call inside `idempotent()`, which supplies the transaction. `card` is set when the money was
 * already taken by the gateway (payInvoiceByCard).
 */
export async function recordPayment(
  rawInput: unknown,
  recordedBy: string,
  card?: { readonly chargeId: string },
): Promise<Outcome> {
  const parsed = parseInput(RecordPaymentInput, rawInput);
  if (!parsed.ok) return refused(parsed.userErrors);
  const { invoiceId, amount } = parsed.value;
  const _id = objectId(invoiceId);
  if (!_id) return notFound(['input', 'invoiceId']);

  // Read → check → write inside one transaction. A concurrent payment on the same invoice makes
  // one of the two transactions hit a write conflict on the invoice document; the driver retries
  // it, and the retry reads the new balance (ADR-0002).
  const record = await Invoice.findById(_id).lean().exec();
  if (!record) return notFound(['input', 'invoiceId']);

  let payment: Money;
  try {
    payment = Money.parse(amount.amount, currency(amount.currency));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return refused([{ code: 'INVALID_AMOUNT', message, field: ['input', 'amount', 'amount'] }]);
  }
  const result = recordDomainPayment(toDomain(record), payment);
  if (!result.ok) return refused(domainError(result.error, ['input', 'amount']));

  await Payment.create([
    {
      invoiceId: _id,
      amountMinor: payment.amountMinor,
      currency: payment.currency.code,
      recordedBy: new Types.ObjectId(recordedBy),
      method: card ? 'CARD' : 'MANUAL',
      reference: card?.chargeId ?? null,
    },
  ]);
  return persist(_id, result, ['input', 'amount']);
}

/**
 * Takes a card payment for an invoice: charge first, then record. The charge is an external side
 * effect, so it happens outside any database transaction (a transaction may be retried; a charge
 * must not be), with the gateway's own idempotency key derived from ours. If recording then fails
 * — another payment settled the balance between our check and our write — the charge is
 * refunded: a compensating action, because there is no transaction spanning us and the gateway.
 */
export async function payInvoiceByCard(
  deps: Deps,
  caller: { userId: string; orgId: string },
  rawInput: unknown,
  key: string,
): Promise<Outcome> {
  const replay = await storedOutcome('payInvoiceByCard', key, caller.userId, rawInput);
  if (replay) return replay;

  const parsed = parseInput(CardPaymentInput, rawInput);
  if (!parsed.ok) return refused(parsed.userErrors);
  const { invoiceId, amount, paymentMethod } = parsed.value;
  const _id = objectId(invoiceId);
  const record = _id ? await Invoice.findById(_id).lean().exec() : null;
  if (!record) return notFound(['input', 'invoiceId']);

  // Check before charging: never take money for a payment the domain would refuse anyway.
  let payment: Money;
  try {
    payment = Money.parse(amount.amount, currency(amount.currency));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return refused([{ code: 'INVALID_AMOUNT', message, field: ['input', 'amount', 'amount'] }]);
  }
  const check = recordDomainPayment(toDomain(record), payment);
  if (!check.ok) return refused(domainError(check.error, ['input', 'amount']));

  const charge = await deps.paymentGateway.charge({
    amount: payment,
    paymentMethod,
    idempotencyKey: gatewayKey(
      `invoice-payment:${caller.orgId}`,
      key,
      record._id.toString(),
      payment.toString(),
      paymentMethod,
    ),
    description: `Invoice ${record.number ?? record._id.toString()}`,
  });
  if (charge.status === 'declined') {
    return refused([
      {
        code: 'CARD_DECLINED',
        message: declineMessage(charge.reason),
        field: ['input', 'paymentMethod'],
      },
    ]);
  }

  const outcome = await idempotent('payInvoiceByCard', key, caller.userId, rawInput, () =>
    recordPayment(rawInput, caller.userId, { chargeId: charge.chargeId }),
  );
  if (!outcome.ok) {
    await deps.paymentGateway.refund(charge.chargeId);
    return refused([
      ...outcome.userErrors,
      {
        code: 'PAYMENT_REFUNDED',
        message: 'The card was charged and immediately refunded.',
        field: [],
      },
    ]);
  }
  return outcome;
}

export async function voidInvoice(id: string): Promise<Outcome> {
  const _id = objectId(id);
  if (!_id) return notFound(['id']);
  return inTransaction(async () => {
    const record = await Invoice.findById(_id).lean().exec();
    if (!record) return notFound(['id']);
    return persist(_id, voidDomainInvoice(toDomain(record)), ['id']);
  });
}
