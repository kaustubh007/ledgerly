import { randomUUID } from 'node:crypto';
import { buildSchema } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SimulatedCharge } from '../src/features/payments/payment-gateway.simulator.ts';
import { loadTypeDefs } from '../src/graphql/schema.ts';
import { CREATE_INVOICE, customer, PAY, SEND, sentInvoice } from './fixtures.ts';
import { lastEmail, signUpUser, startTestApp, type SignedUp, type TestApp } from './harness.ts';

// The Phase 2 gate for PLAN §3.6. Two organisations with data in every tenant collection.
// A member of A, with A selected, uses every query and mutation, aiming at B's ids. Nothing of
// B's may come back and nothing of B's may change. Then the same member selects B: refused.

let app: TestApp;
let a: SignedUp;
let b: SignedUp;
const B = { customer: '', invoice: '', paidInvoice: '', draft: '', member: '' };
const A_CUSTOMER_NAME = 'Alpha Customer';
const B_CUSTOMER_NAME = 'Beta Customer';

/** Fields that are not tenant data: identity and session management, scoped to the user. */
const NOT_TENANT_SCOPED = new Set([
  'Query.viewer',
  'Query.plans', // the plan catalogue: the same for everyone
  'Mutation.signUp',
  'Mutation.logIn',
  'Mutation.verifyEmail',
  'Mutation.requestPasswordReset',
  'Mutation.resetPassword',
  'Mutation.revokeSession',
  'Mutation.revokeOtherSessions',
  'Mutation.createOrganization',
  'Mutation.acceptInvitation',
]);

const covered = new Set<string>();
const cover = (...fields: string[]): void => {
  for (const f of fields) covered.add(f);
};

beforeAll(async () => {
  app = await startTestApp();
  a = await signUpUser(app, 'Alpha');
  b = await signUpUser(app, 'Beta');

  await customer(a, { name: A_CUSTOMER_NAME });
  B.customer = await customer(b, { name: B_CUSTOMER_NAME, defaultCurrency: 'EUR' });
  B.invoice = await sentInvoice(b, B.customer, '500.00', 'EUR', '2000-01-01');
  B.paidInvoice = await sentInvoice(b, B.customer, '20.00', 'EUR');
  await b.client.ok(PAY, {
    key: randomUUID(),
    input: { invoiceId: B.paidInvoice, amount: { amount: '20', currency: 'EUR' } },
  });
  const draft = await b.client.ok<any>(CREATE_INVOICE, {
    key: randomUUID(),
    input: {
      customerId: B.customer,
      currency: 'EUR',
      dueDate: '2099-01-01',
      lines: [{ description: 'x', quantity: '1', unitPrice: '1' }],
    },
  });
  B.draft = draft.createInvoice.invoice.id;
  const member = await signUpUser(app, 'BetaMember');
  await b.client.ok(
    `mutation ($e: String!) { inviteMember(email: $e, role: VIEWER) { userErrors { code } } }`,
    { e: member.email },
  );
  await b.client.ok(
    `mutation ($t: String!) { acceptInvitation(token: $t) { userErrors { code } } }`,
    {
      t: new URL((await lastEmail(member.email, 'invitation'))['link'] ?? '').searchParams.get(
        'token',
      ),
    },
  );
  await b.client.ok(
    `mutation { inviteMember(email: "pending@beta.example", role: ADMIN) { userErrors { code } } }`,
  );
  B.member = member.userId;
  await sentInvoice(a, await customer(a), '1.00', 'USD');
});
afterAll(() => app.close());

/** B's data as B sees it: compared before and after A's attempts. */
async function snapshotOfB(): Promise<unknown> {
  return b.client.ok(`query {
    organization { plan { code } usage { customers invoicesThisMonth seats } members { userId role } invitations { email role } }
    customers { edges { node { id name email } } }
    invoices { edges { node { id number status lines { description } total { amount } paid { amount } payments { id } } } }
    dashboard { totals { currency outstanding { amount } overdue { amount } } countsByStatus { status count } }
  }`);
}

describe('tenant isolation', () => {
  let before: unknown;
  beforeAll(async () => {
    before = await snapshotOfB();
  });

  it('lists and searches only the selected organisation', async () => {
    cover('Query.customers', 'Query.invoices', 'Query.organization');
    const r = await a.client.ok<any>(`query {
      customers { edges { node { name } } }
      search: customers(search: "beta") { edges { node { name } } }
      byForeignCustomer: invoices(customerId: "${B.customer}") { edges { node { id } } }
      invoices { edges { node { currency customer { name } } } }
      organization { name members { email } invitations { email } }
    }`);
    expect(r.customers.edges.map((e: any) => e.node.name)).not.toContain(B_CUSTOMER_NAME);
    expect(r.search.edges).toEqual([]);
    expect(r.byForeignCustomer.edges).toEqual([]);
    expect(r.invoices.edges.every((e: any) => e.node.currency === 'USD')).toBe(true);
    expect(r.organization.members.map((m: any) => m.email)).toEqual([a.email]);
    expect(r.organization.invitations).toEqual([]);
  });

  it('cannot fetch another organisation’s records by id', async () => {
    cover('Query.customer', 'Query.invoice');
    const r = await a.client.ok<any>(
      `query ($c: ID!, $i: ID!) { customer(id: $c) { id } invoice(id: $i) { id } }`,
      {
        c: B.customer,
        i: B.invoice,
      },
    );
    expect(r).toEqual({ customer: null, invoice: null });
  });

  it('aggregates only the selected organisation (dashboard)', async () => {
    cover('Query.dashboard');
    const r = await a.client.ok<any>(
      'query { dashboard { totals { currency } countsByStatus { status count } } }',
    );
    expect(r.dashboard.totals.map((t: any) => t.currency)).toEqual(['USD']);
    expect(r.dashboard.countsByStatus).toEqual([{ status: 'SENT', count: 1 }]);
  });

  it('cannot change another organisation’s records: every mutation says NOT_FOUND', async () => {
    cover(
      'Mutation.updateCustomer',
      'Mutation.createInvoice',
      'Mutation.replaceInvoiceLines',
      'Mutation.sendInvoice',
      'Mutation.recordPayment',
      'Mutation.voidInvoice',
      'Mutation.changeMemberRole',
      'Mutation.removeMember',
      'Mutation.payInvoiceByCard',
    );
    const line = { description: 'pwned', quantity: '1', unitPrice: '1' };
    const attempts: [string, Record<string, unknown>][] = [
      [
        `mutation ($id: ID!) { r: updateCustomer(id: $id, input: { name: "pwned", defaultCurrency: "EUR", documentLocale: "en" }) { userErrors { code } } }`,
        { id: B.customer },
      ],
      [
        CREATE_INVOICE.replace('createInvoice(', 'r: createInvoice('),
        {
          key: randomUUID(),
          input: { customerId: B.customer, currency: 'EUR', dueDate: '2099-01-01', lines: [line] },
        },
      ],
      [
        `mutation ($id: ID!, $l: [InvoiceLineInput!]!) { r: replaceInvoiceLines(id: $id, lines: $l) { userErrors { code } } }`,
        { id: B.draft, l: [line] },
      ],
      [SEND.replace('sendInvoice(', 'r: sendInvoice('), { id: B.draft, key: randomUUID() }],
      [
        PAY.replace('recordPayment(', 'r: recordPayment('),
        {
          key: randomUUID(),
          input: { invoiceId: B.invoice, amount: { amount: '1', currency: 'EUR' } },
        },
      ],
      [
        `mutation ($id: ID!) { r: voidInvoice(id: $id) { userErrors { code } } }`,
        { id: B.invoice },
      ],
      [
        `mutation ($i: CardPaymentInput!, $k: ID!) { r: payInvoiceByCard(input: $i, idempotencyKey: $k) { userErrors { code } } }`,
        {
          k: randomUUID(),
          i: {
            invoiceId: B.invoice,
            amount: { amount: '1', currency: 'EUR' },
            paymentMethod: 'pm_card_visa',
          },
        },
      ],
      [
        `mutation ($u: ID!) { r: changeMemberRole(userId: $u, role: OWNER) { userErrors { code } } }`,
        { u: B.member },
      ],
      [
        `mutation ($u: ID!) { r: removeMember(userId: $u) { userErrors { code } } }`,
        { u: B.member },
      ],
    ];
    for (const [mutation, variables] of attempts) {
      const r = await a.client.ok<any>(mutation, variables);
      expect(
        r.r.userErrors.map((e: any) => e.code),
        mutation.slice(0, 60),
      ).toEqual(['NOT_FOUND']);
    }
  });

  it('changes only the selected organisation’s plan, and never charges for a foreign invoice', async () => {
    cover('Mutation.changePlan');
    const r = await a.client.ok<any>(
      `mutation ($k: ID!) { changePlan(input: { plan: PRO, paymentMethod: "pm_card_visa" }, idempotencyKey: $k) { organization { slug plan { code } } } }`,
      { k: randomUUID() },
    );
    expect(r.changePlan.organization).toEqual({ slug: a.orgSlug, plan: { code: 'PRO' } });
    // The payInvoiceByCard attempt on B's invoice above must not have reached the gateway.
    expect(
      await SimulatedCharge.countDocuments({ amountMinor: 100n, currency: 'EUR' }).exec(),
    ).toBe(0);
  });

  it('creates only in the selected organisation', async () => {
    cover('Mutation.createCustomer', 'Mutation.inviteMember');
    await a.client.ok(
      `mutation { createCustomer(input: { name: "New", defaultCurrency: "USD", documentLocale: "en" }) { userErrors { code } } }`,
    );
    await a.client.ok(
      `mutation { inviteMember(email: "someone@alpha.example", role: VIEWER) { userErrors { code } } }`,
    );
  });

  it('refuses every tenant field when a member of A selects B', async () => {
    const intruder = a.client;
    const fields = [
      'query { organization { id } }',
      'query { customers { edges { node { id } } } }',
      `query { customer(id: "${B.customer}") { id } }`,
      'query { invoices { edges { node { id } } } }',
      `query { invoice(id: "${B.invoice}") { id } }`,
      'query { dashboard { totals { currency } } }',
      'mutation { changePlan(input: { plan: BUSINESS, paymentMethod: "pm_card_visa" }, idempotencyKey: "x") { userErrors { code } } }',
    ];
    for (const query of fields) {
      const r = await intruder.gql(query, {}, { 'x-org': b.orgSlug });
      expect(r.errors?.[0]?.extensions?.code, query).toBe('FORBIDDEN');
    }
  });

  it('left B’s data exactly as it was', async () => {
    expect(await snapshotOfB()).toEqual(before);
  });

  it('scopes idempotency keys per organisation', async () => {
    const key = randomUUID();
    const input = (customerId: string) => ({
      customerId,
      currency: 'USD',
      dueDate: '2099-01-01',
      lines: [{ description: 'x', quantity: '1', unitPrice: '1' }],
    });
    const aCustomer = await customer(a);
    const bCustomer = await customer(b);
    const ra = await a.client.ok<any>(CREATE_INVOICE, { key, input: input(aCustomer) });
    const rb = await b.client.ok<any>(CREATE_INVOICE, { key, input: input(bCustomer) });
    expect(rb.createInvoice.userErrors).toEqual([]);
    expect(rb.createInvoice.invoice.id).not.toBe(ra.createInvoice.invoice.id);
  });

  it('covers every tenant query and mutation in the schema', () => {
    const schema = buildSchema(loadTypeDefs('tenant'));
    const all = [
      ...Object.keys(schema.getQueryType()?.getFields() ?? {}).map((f) => `Query.${f}`),
      ...Object.keys(schema.getMutationType()?.getFields() ?? {}).map((f) => `Mutation.${f}`),
    ];
    const missing = all.filter((f) => !covered.has(f) && !NOT_TENANT_SCOPED.has(f));
    // A new resolver fails here until the leak suite exercises it.
    expect(missing).toEqual([]);
  });
});
