import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CREATE_INVOICE, customer, PAY, sentInvoice } from './fixtures.ts';
import { lastEmail, signUpUser, startTestApp, tokenFrom, type TestApp } from './harness.ts';

const DASHBOARD = `query { dashboard { totals { currency outstanding { amount } overdue { amount } } countsByStatus { status count } } }`;

let app: TestApp;
beforeAll(async () => {
  app = await startTestApp();
});
afterAll(() => app.close());

describe('invoices', () => {
  it('computes line and invoice totals with half-even rounding per line', async () => {
    const user = await signUpUser(app);
    const customerId = await customer(user);
    const r = await user.client.ok<any>(CREATE_INVOICE, {
      key: randomUUID(),
      input: {
        customerId,
        currency: 'USD',
        dueDate: '2026-12-31',
        lines: [
          { description: 'Hours', quantity: '0.333', unitPrice: '10.00' },
          { description: 'Fee', quantity: '0.5', unitPrice: '0.05' },
        ],
      },
    });
    expect(r.createInvoice.invoice).toMatchObject({
      status: 'DRAFT',
      number: null,
      total: { amount: '3.35', currency: 'USD' },
      lines: [
        { quantity: '0.333', total: { amount: '3.33' } },
        { quantity: '0.5', total: { amount: '0.02' } },
      ],
    });
  });

  it('reports input problems as userErrors with field paths', async () => {
    const user = await signUpUser(app);
    const customerId = await customer(user);
    const r = await user.client.ok<any>(CREATE_INVOICE, {
      key: randomUUID(),
      input: {
        customerId,
        currency: 'JPY',
        dueDate: '2026-12-31',
        lines: [{ description: 'x', quantity: '1', unitPrice: '1.5' }],
      },
    });
    expect(r.createInvoice.userErrors).toEqual([
      { code: 'INVALID_AMOUNT', field: ['input', 'lines', '0'] },
    ]);
    const bad = await user.client.gql<any>(CREATE_INVOICE, {
      key: randomUUID(),
      input: { customerId, currency: 'USD', dueDate: '2026-02-30', lines: [] },
    });
    expect(bad.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('numbers invoices sequentially when sent, and emails the customer', async () => {
    const user = await signUpUser(app);
    const customerId = await customer(user, { email: `c-${randomUUID()}@example.com` });
    const first = await sentInvoice(user, customerId);
    const second = await sentInvoice(user, customerId);
    const year = String(app.clock.now().getUTCFullYear());
    const numbers = await Promise.all(
      [first, second].map(
        async (id) =>
          (await user.client.ok<any>(`query ($id: ID!) { invoice(id: $id) { number } }`, { id }))
            .invoice.number,
      ),
    );
    expect(numbers).toEqual([`INV-${year}-00001`, `INV-${year}-00002`]);
  });

  it('replays an idempotent request, and refuses a key reused for a different request', async () => {
    const user = await signUpUser(app);
    const customerId = await customer(user);
    const key = randomUUID();
    const input = {
      customerId,
      currency: 'USD',
      dueDate: '2026-12-31',
      lines: [{ description: 'x', quantity: '1', unitPrice: '5' }],
    };
    const a = await user.client.ok<any>(CREATE_INVOICE, { key, input });
    const b = await user.client.ok<any>(CREATE_INVOICE, { key, input });
    expect(b.createInvoice.invoice.id).toBe(a.createInvoice.invoice.id);
    const count = await user.client.ok<any>('query { invoices { edges { node { id } } } }');
    expect(count.invoices.edges).toHaveLength(1);

    const c = await user.client.ok<any>(CREATE_INVOICE, {
      key,
      input: { ...input, dueDate: '2027-01-01' },
    });
    expect(c.createInvoice.userErrors).toEqual([
      { code: 'IDEMPOTENCY_KEY_REUSED', field: ['idempotencyKey'] },
    ]);
  });

  it('records partial and full payments; refuses overpayment, other currencies and non-open invoices', async () => {
    const user = await signUpUser(app);
    const invoiceId = await sentInvoice(user, await customer(user));
    const pay = (amount: string, currency = 'USD') =>
      user.client.ok<any>(PAY, {
        key: randomUUID(),
        input: { invoiceId, amount: { amount, currency } },
      });

    expect((await pay('30')).recordPayment.invoice).toMatchObject({
      status: 'PARTIALLY_PAID',
      paid: { amount: '30.00' },
      balance: { amount: '70.00' },
    });
    expect((await pay('70.01')).recordPayment.userErrors).toEqual([
      { code: 'OVERPAYMENT', field: ['input', 'amount'] },
    ]);
    expect((await pay('10', 'EUR')).recordPayment.userErrors).toEqual([
      { code: 'CURRENCY_MISMATCH', field: ['input', 'amount'] },
    ]);
    expect((await pay('0')).recordPayment.userErrors).toEqual([
      { code: 'NON_POSITIVE_AMOUNT', field: ['input', 'amount'] },
    ]);
    const paid = (await pay('70')).recordPayment.invoice;
    expect(paid).toMatchObject({ status: 'PAID', balance: { amount: '0.00' } });
    expect(paid.payments.map((p: any) => p.amount.amount)).toEqual(['30.00', '70.00']);
    expect((await pay('1')).recordPayment.userErrors).toEqual([
      { code: 'INVALID_TRANSITION', field: ['input', 'amount'] },
    ]);
  });

  it('applies the permission table: VIEWER reads but cannot record payments', async () => {
    const owner = await signUpUser(app);
    const invoiceId = await sentInvoice(owner, await customer(owner));
    const viewer = await signUpUser(app);
    await owner.client.ok(
      `mutation ($e: String!) { inviteMember(email: $e, role: VIEWER) { userErrors { code } } }`,
      { e: viewer.email },
    );
    await viewer.client.ok(
      `mutation ($t: String!) { acceptInvitation(token: $t) { userErrors { code } } }`,
      {
        t: tokenFrom((await lastEmail(viewer.email, 'invitation'))['link']),
      },
    );
    viewer.client.org = owner.orgSlug;
    expect(
      (await viewer.client.ok<any>('query { invoices { edges { node { id } } } }')).invoices.edges,
    ).toHaveLength(1);
    const r = await viewer.client.gql(PAY, {
      key: randomUUID(),
      input: { invoiceId, amount: { amount: '1', currency: 'USD' } },
    });
    expect(r.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('voids drafts and sent invoices only', async () => {
    const user = await signUpUser(app);
    const id = await sentInvoice(user, await customer(user));
    const VOID = `mutation ($id: ID!) { voidInvoice(id: $id) { invoice { status } userErrors { code } } }`;
    expect((await user.client.ok<any>(VOID, { id })).voidInvoice.invoice.status).toBe('VOID');
    expect((await user.client.ok<any>(VOID, { id })).voidInvoice.userErrors).toEqual([
      { code: 'INVALID_TRANSITION' },
    ]);
  });

  it('paginates newest first with stable cursors', async () => {
    const user = await signUpUser(app);
    const customerId = await customer(user);
    for (let i = 0; i < 5; i += 1) await sentInvoice(user, customerId);
    const PAGE = `query ($after: String) { invoices(first: 2, after: $after) { edges { node { number } } pageInfo { hasNextPage endCursor } } }`;
    const seen: string[] = [];
    let after: string | null = null;
    for (;;) {
      const page: any = (await user.client.ok<any>(PAGE, { after })).invoices;
      seen.push(...page.edges.map((e: any) => e.node.number));
      if (!page.pageInfo.hasNextPage) break;
      after = page.pageInfo.endCursor;
    }
    expect(seen).toEqual([...seen].sort().reverse());
    expect(new Set(seen).size).toBe(5);
  });
});

describe('dashboard', () => {
  it('totals per currency, never across currencies, with overdue in the organisation’s calendar', async () => {
    const user = await signUpUser(app);
    const usd = await customer(user);
    await sentInvoice(user, usd, '100.00', 'USD', '2000-01-01'); // overdue
    await sentInvoice(user, usd, '50.00', 'USD', '2099-01-01');
    await sentInvoice(user, usd, '7.000', 'KWD', '2099-01-01');
    const r = await user.client.ok<any>(DASHBOARD);
    expect(r.dashboard.totals).toEqual([
      { currency: 'KWD', outstanding: { amount: '7.000' }, overdue: { amount: '0.000' } },
      { currency: 'USD', outstanding: { amount: '150.00' }, overdue: { amount: '100.00' } },
    ]);
    expect(r.dashboard.countsByStatus).toEqual([{ status: 'SENT', count: 3 }]);
  });
});
