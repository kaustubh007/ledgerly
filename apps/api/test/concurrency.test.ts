import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signUpUser, startTestApp, type TestApp } from './harness.ts';
import { CREATE_INVOICE, customer, PAY, SEND, sentInvoice, upgrade } from './fixtures.ts';

// The Phase 2 gate for ADR-0002: the guarantees hold when requests really overlap.

let app: TestApp;
beforeAll(async () => {
  app = await startTestApp();
});
afterAll(() => app.close());

describe('concurrent payments', () => {
  it('ten simultaneous payments of 30.00 against 100.00: exactly three succeed', async () => {
    const user = await signUpUser(app);
    const invoiceId = await sentInvoice(user, await customer(user), '100.00');

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        user.client.ok<any>(PAY, {
          key: randomUUID(),
          input: { invoiceId, amount: { amount: '30.00', currency: 'USD' } },
        }),
      ),
    );
    const accepted = results.filter((r) => r.recordPayment.userErrors.length === 0);
    const refused = results.flatMap((r) => r.recordPayment.userErrors.map((e: any) => e.code));
    expect(accepted).toHaveLength(3);
    expect(refused).toEqual(Array(7).fill('OVERPAYMENT'));

    const invoice = await user.client.ok<any>(
      `query ($id: ID!) { invoice(id: $id) { status paid { amount } payments { id } } }`,
      { id: invoiceId },
    );
    expect(invoice.invoice).toMatchObject({ status: 'PARTIALLY_PAID', paid: { amount: '90.00' } });
    expect(invoice.invoice.payments).toHaveLength(3);
  });

  it('a double-submitted payment (same idempotency key, in parallel) is recorded once', async () => {
    const user = await signUpUser(app);
    const invoiceId = await sentInvoice(user, await customer(user), '100.00');
    const key = randomUUID();
    const input = { invoiceId, amount: { amount: '10.00', currency: 'USD' } };

    const results = await Promise.all(
      Array.from({ length: 5 }, () => user.client.ok<any>(PAY, { key, input })),
    );
    for (const r of results) expect(r.recordPayment.userErrors).toEqual([]);
    const invoice = await user.client.ok<any>(
      `query ($id: ID!) { invoice(id: $id) { paid { amount } payments { id } } }`,
      { id: invoiceId },
    );
    expect(invoice.invoice.paid.amount).toBe('10.00');
    expect(invoice.invoice.payments).toHaveLength(1);
  });
});

describe('concurrent sends', () => {
  it('twenty invoices sent at once get twenty distinct numbers with no gaps', async () => {
    const user = await signUpUser(app);
    await upgrade(user); // FREE allows 10 invoices a month
    const customerId = await customer(user);
    const ids = await Promise.all(
      Array.from({ length: 20 }, async () => {
        const r = await user.client.ok<any>(CREATE_INVOICE, {
          key: randomUUID(),
          input: {
            customerId,
            currency: 'USD',
            dueDate: '2099-01-01',
            lines: [{ description: 'x', quantity: '1', unitPrice: '1' }],
          },
        });
        return r.createInvoice.invoice.id as string;
      }),
    );
    const sent = await Promise.all(
      ids.map((id) => user.client.ok<any>(SEND, { id, key: randomUUID() })),
    );
    const numbers = sent
      .map((r) => Number(r.sendInvoice.invoice.number.split('-')[2]))
      .sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});
