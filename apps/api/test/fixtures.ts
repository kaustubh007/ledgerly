import { randomUUID } from 'node:crypto';
import type { SignedUp } from './harness.ts';

export const CREATE_CUSTOMER = `mutation ($input: CustomerInput!) { createCustomer(input: $input) { customer { id } userErrors { code field } } }`;
export const CREATE_INVOICE = `mutation ($input: CreateInvoiceInput!, $key: ID!) {
  createInvoice(input: $input, idempotencyKey: $key) {
    invoice { id status number total { amount currency } lines { quantity total { amount } } }
    userErrors { code field }
  }
}`;
export const SEND = `mutation ($id: ID!, $key: ID!) { sendInvoice(id: $id, idempotencyKey: $key) { invoice { id number status } userErrors { code } } }`;
export const PAY = `mutation ($input: RecordPaymentInput!, $key: ID!) {
  recordPayment(input: $input, idempotencyKey: $key) {
    invoice { status paid { amount } balance { amount } payments { amount { amount } } }
    userErrors { code field }
  }
}`;

export async function customer(
  user: SignedUp,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const r = await user.client.ok<any>(CREATE_CUSTOMER, {
    input: {
      name: 'Acme',
      email: 'billing@acme.example',
      defaultCurrency: 'USD',
      documentLocale: 'en-US',
      ...overrides,
    },
  });
  return r.createCustomer.customer.id;
}

export async function sentInvoice(
  user: SignedUp,
  customerId: string,
  unitPrice = '100.00',
  currency = 'USD',
  dueDate = '2099-01-01',
): Promise<string> {
  const created = await user.client.ok<any>(CREATE_INVOICE, {
    key: randomUUID(),
    input: {
      customerId,
      currency,
      dueDate,
      lines: [{ description: 'Work', quantity: '1', unitPrice }],
    },
  });
  const id = created.createInvoice.invoice.id;
  await user.client.ok(SEND, { id, key: randomUUID() });
  return id;
}
