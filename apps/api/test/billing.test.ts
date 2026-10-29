import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BillingEvent } from '../src/features/billing/billing-event.model.ts';
import { SimulatedCharge } from '../src/features/payments/payment-gateway.simulator.ts';
import { runInTenant } from '../src/context/request-context.ts';
import {
  CHANGE_PLAN,
  CREATE_CUSTOMER,
  CREATE_INVOICE,
  customer,
  sentInvoice,
  upgrade,
} from './fixtures.ts';
import {
  lastEmail,
  signUpUser,
  startTestApp,
  tokenFrom,
  type SignedUp,
  type TestApp,
} from './harness.ts';

const ORG = `query { organization { plan { code limits { customers invoicesPerMonth seats } features { customBranding } } usage { customers invoicesThisMonth seats } } }`;
const PAY_BY_CARD = `mutation ($input: CardPaymentInput!, $key: ID!) {
  payInvoiceByCard(input: $input, idempotencyKey: $key) {
    invoice { status paid { amount } payments { method reference amount { amount } } }
    userErrors { code field }
  }
}`;
const INVITE = `mutation ($e: String!) { inviteMember(email: $e, role: VIEWER) { invitation { id } userErrors { code } } }`;

let app: TestApp;
beforeAll(async () => {
  app = await startTestApp();
});
afterAll(() => app.close());

const newCustomer = (user: SignedUp, name = 'C') =>
  user.client.ok<any>(CREATE_CUSTOMER, {
    input: { name, defaultCurrency: 'USD', documentLocale: 'en' },
  });

async function joinAs(owner: SignedUp, role: 'VIEWER' | 'ADMIN'): Promise<SignedUp> {
  const member = await signUpUser(app);
  await owner.client.ok(
    `mutation ($e: String!, $r: Role!) { inviteMember(email: $e, role: $r) { userErrors { code } } }`,
    { e: member.email, r: role },
  );
  await member.client.ok(
    `mutation ($t: String!) { acceptInvitation(token: $t) { userErrors { code } } }`,
    {
      t: tokenFrom((await lastEmail(member.email, 'invitation'))['link']),
    },
  );
  member.client.org = owner.orgSlug;
  return member;
}

const charges = (description: RegExp) =>
  SimulatedCharge.find({ description: { $regex: description } })
    .lean()
    .exec();

describe('plans', () => {
  it('lists the catalogue and starts every organisation on FREE', async () => {
    const user = await signUpUser(app);
    const plans = await user.client.ok<any>(
      'query { plans { code monthlyPrice { amount currency } } }',
    );
    expect(plans.plans).toEqual([
      { code: 'FREE', monthlyPrice: { amount: '0.00', currency: 'USD' } },
      { code: 'PRO', monthlyPrice: { amount: '29.00', currency: 'USD' } },
      { code: 'BUSINESS', monthlyPrice: { amount: '99.00', currency: 'USD' } },
    ]);
    const org = await user.client.ok<any>(ORG);
    expect(org.organization.plan).toEqual({
      code: 'FREE',
      limits: { customers: 5, invoicesPerMonth: 10, seats: 2 },
      features: { customBranding: false },
    });
    expect(org.organization.usage).toEqual({ customers: 0, invoicesThisMonth: 0, seats: 1 });
  });
});

describe('plan limits', () => {
  it('refuses the sixth customer on FREE, with a userError', async () => {
    const user = await signUpUser(app);
    for (let i = 0; i < 5; i += 1)
      expect((await newCustomer(user)).createCustomer.userErrors).toEqual([]);
    expect((await newCustomer(user)).createCustomer.userErrors).toEqual([
      { code: 'PLAN_LIMIT_REACHED', field: [] },
    ]);
  });

  it('holds under concurrency: ten simultaneous creates on FREE create exactly five (no write skew)', async () => {
    const user = await signUpUser(app);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => newCustomer(user, `C${String(i)}`)),
    );
    const created = results.filter((r) => r.createCustomer.userErrors.length === 0);
    expect(created).toHaveLength(5);
    expect((await user.client.ok<any>(ORG)).organization.usage.customers).toBe(5);
  });

  it('refuses the eleventh invoice of the month on FREE', async () => {
    const user = await signUpUser(app);
    const customerId = await customer(user);
    const create = () =>
      user.client.ok<any>(CREATE_INVOICE, {
        key: randomUUID(),
        input: {
          customerId,
          currency: 'USD',
          dueDate: '2027-04-01',
          lines: [{ description: 'x', quantity: '1', unitPrice: '1' }],
        },
      });
    // createdAt is set by MongoDB timestamps (real time), so this is the real current month. The
    // month boundary itself is unit-tested in src/features/billing/limits.test.ts.
    const results = [];
    for (let i = 0; i < 11; i += 1) results.push(await create());
    expect(results.slice(0, 10).every((r) => r.createInvoice.userErrors.length === 0)).toBe(true);
    expect(results[10].createInvoice.userErrors).toEqual([
      { code: 'PLAN_LIMIT_REACHED', field: [] },
    ]);
  });

  it('counts open invitations as seats, and re-inviting does not take another', async () => {
    const user = await signUpUser(app);
    expect(
      (await user.client.ok<any>(INVITE, { e: 'one@example.com' })).inviteMember.userErrors,
    ).toEqual([]);
    expect(
      (await user.client.ok<any>(INVITE, { e: 'one@example.com' })).inviteMember.userErrors,
    ).toEqual([]);
    expect(
      (await user.client.ok<any>(INVITE, { e: 'two@example.com' })).inviteMember.userErrors,
    ).toEqual([{ code: 'PLAN_LIMIT_REACHED' }]);
  });
});

describe('changing plan', () => {
  const change = (user: SignedUp, plan: string, paymentMethod?: string, key = randomUUID()) =>
    user.client.ok<any>(CHANGE_PLAN, {
      key,
      input: { plan, ...(paymentMethod ? { paymentMethod } : {}) },
    });

  it('only an owner may change the plan', async () => {
    const owner = await signUpUser(app);
    await upgrade(owner, 'PRO');
    const admin = await joinAs(owner, 'ADMIN');
    const r = await admin.client.gql(CHANGE_PLAN, {
      key: randomUUID(),
      input: { plan: 'BUSINESS', paymentMethod: 'pm_card_visa' },
    });
    expect(r.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('needs a payment method for an upgrade, and leaves the plan alone when the card is declined', async () => {
    const user = await signUpUser(app);
    expect((await change(user, 'PRO')).changePlan.userErrors).toEqual([
      { code: 'PAYMENT_METHOD_REQUIRED', field: ['input', 'paymentMethod'] },
    ]);
    expect((await change(user, 'PRO', 'pm_card_declined')).changePlan.userErrors).toEqual([
      { code: 'CARD_DECLINED', field: ['input', 'paymentMethod'] },
    ]);
    expect((await user.client.ok<any>(ORG)).organization.plan.code).toBe('FREE');
  });

  it('upgrades after charging the card once, even when the request is retried', async () => {
    const user = await signUpUser(app);
    const key = randomUUID();
    const first = await change(user, 'PRO', 'pm_card_visa', key);
    const replay = await change(user, 'PRO', 'pm_card_visa', key);
    expect(first.changePlan.organization.plan.code).toBe('PRO');
    expect(replay.changePlan).toEqual(first.changePlan);

    const charged = await charges(new RegExp(`org ${user.orgId}$`));
    expect(charged).toHaveLength(1);
    expect(charged[0]).toMatchObject({ status: 'approved', amountMinor: 2900n, currency: 'USD' });
    const events = await runInTenant(user.orgId, 'OWNER', () => BillingEvent.find().lean().exec());
    expect(events).toMatchObject([
      { fromPlan: 'FREE', toPlan: 'PRO', amountMinor: 2900n, chargeId: charged[0]?.chargeId },
    ]);
    expect((await change(user, 'PRO', 'pm_card_visa')).changePlan.userErrors).toEqual([
      { code: 'PLAN_UNCHANGED', field: ['input', 'plan'] },
    ]);
  });

  it('downgrades without charging; over-limit data stays, creating more stops', async () => {
    const user = await signUpUser(app);
    await upgrade(user, 'PRO');
    for (let i = 0; i < 6; i += 1) await newCustomer(user);
    const down = await change(user, 'FREE');
    expect(down.changePlan.userErrors).toEqual([]);
    const org = await user.client.ok<any>(ORG);
    expect(org.organization.plan.code).toBe('FREE');
    expect(org.organization.usage.customers).toBe(6);
    expect((await newCustomer(user)).createCustomer.userErrors).toEqual([
      { code: 'PLAN_LIMIT_REACHED', field: [] },
    ]);
  });
});

describe('card payments (PaymentGatewaySimulator)', () => {
  const pay = (
    user: SignedUp,
    invoiceId: string,
    amount: string,
    paymentMethod = 'pm_card_visa',
    key = randomUUID(),
  ) =>
    user.client.ok<any>(PAY_BY_CARD, {
      key,
      input: { invoiceId, amount: { amount, currency: 'USD' }, paymentMethod },
    });

  it('charges the card and records a CARD payment with the gateway reference', async () => {
    const user = await signUpUser(app);
    const invoiceId = await sentInvoice(user, await customer(user), '100.00');
    const r = await pay(user, invoiceId, '100');
    expect(r.payInvoiceByCard.userErrors).toEqual([]);
    expect(r.payInvoiceByCard.invoice.status).toBe('PAID');
    const [payment] = r.payInvoiceByCard.invoice.payments;
    expect(payment).toMatchObject({ method: 'CARD', amount: { amount: '100.00' } });
    expect(payment.reference).toMatch(/^ch_sim_/);
  });

  it('records nothing when the card is declined', async () => {
    const user = await signUpUser(app);
    const invoiceId = await sentInvoice(user, await customer(user), '100.00');
    const r = await pay(user, invoiceId, '50', 'pm_card_insufficient_funds');
    expect(r.payInvoiceByCard.userErrors).toEqual([
      { code: 'CARD_DECLINED', field: ['input', 'paymentMethod'] },
    ]);
    const invoice = await user.client.ok<any>(
      `query ($id: ID!) { invoice(id: $id) { status payments { id } } }`,
      { id: invoiceId },
    );
    expect(invoice.invoice).toEqual({ status: 'SENT', payments: [] });
  });

  it('never charges for a payment the domain would refuse', async () => {
    const user = await signUpUser(app);
    const invoiceId = await sentInvoice(user, await customer(user), '100.00');
    const r = await pay(user, invoiceId, '100.01');
    expect(r.payInvoiceByCard.userErrors).toEqual([
      { code: 'OVERPAYMENT', field: ['input', 'amount'] },
    ]);
    expect(await charges(/./).then((all) => all.filter((c) => c.amountMinor === 10001n))).toEqual(
      [],
    );
  });

  it('charges once and records once when the request is retried', async () => {
    const user = await signUpUser(app);
    const invoiceId = await sentInvoice(user, await customer(user), '100.00');
    const key = randomUUID();
    await Promise.all([
      pay(user, invoiceId, '40', 'pm_card_visa', key),
      pay(user, invoiceId, '40', 'pm_card_visa', key),
    ]);
    await pay(user, invoiceId, '40', 'pm_card_visa', key);
    const invoice = await user.client.ok<any>(
      `query ($id: ID!) { invoice(id: $id) { paid { amount } payments { reference } } }`,
      { id: invoiceId },
    );
    expect(invoice.invoice.paid.amount).toBe('40.00');
    expect(invoice.invoice.payments).toHaveLength(1);
    expect(
      await SimulatedCharge.countDocuments({
        chargeId: invoice.invoice.payments[0].reference,
      }).exec(),
    ).toBe(1);
  });

  it('refunds a charge that can no longer be recorded (two cards racing for one balance)', async () => {
    const user = await signUpUser(app);
    const invoiceId = await sentInvoice(user, await customer(user), '100.00');
    const results = await Promise.all([pay(user, invoiceId, '60'), pay(user, invoiceId, '60')]);
    const ok = results.filter((r) => r.payInvoiceByCard.userErrors.length === 0);
    expect(ok).toHaveLength(1);
    const refused = results
      .find((r) => r.payInvoiceByCard.userErrors.length > 0)
      ?.payInvoiceByCard.userErrors.map((e: any) => e.code);
    // Either the second request was refused before charging, or it was charged, lost the race
    // inside the transaction, and was refunded. Never: charged and kept.
    expect([['OVERPAYMENT'], ['OVERPAYMENT', 'PAYMENT_REFUNDED']]).toContainEqual(refused);

    const invoice = await user.client.ok<any>(
      `query ($id: ID!) { invoice(id: $id) { paid { amount } payments { reference } } }`,
      { id: invoiceId },
    );
    expect(invoice.invoice.paid.amount).toBe('60.00');
    const kept = await SimulatedCharge.find({
      amountMinor: 6000n,
      status: 'approved',
      refundedAt: null,
      chargeId: { $in: invoice.invoice.payments.map((p: any) => p.reference) },
    })
      .lean()
      .exec();
    expect(kept).toHaveLength(1);
  });

  it('is limited by role: a VIEWER cannot take payments', async () => {
    const owner = await signUpUser(app);
    const invoiceId = await sentInvoice(owner, await customer(owner), '10.00');
    const viewer = await joinAs(owner, 'VIEWER');
    const r = await viewer.client.gql(PAY_BY_CARD, {
      key: randomUUID(),
      input: { invoiceId, amount: { amount: '1', currency: 'USD' }, paymentMethod: 'pm_card_visa' },
    });
    expect(r.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});

describe('retrying with a different card', () => {
  it('a declined card, then another card with the same request key, is a new charge (not a gateway conflict)', async () => {
    const user = await signUpUser(app);
    const key = randomUUID();
    const declined = await user.client.ok<any>(CHANGE_PLAN, {
      key,
      input: { plan: 'PRO', paymentMethod: 'pm_card_declined' },
    });
    expect(declined.changePlan.userErrors).toEqual([
      { code: 'CARD_DECLINED', field: ['input', 'paymentMethod'] },
    ]);
    const approved = await user.client.ok<any>(CHANGE_PLAN, {
      key,
      input: { plan: 'PRO', paymentMethod: 'pm_card_visa' },
    });
    expect(approved.changePlan.organization.plan.code).toBe('PRO');
  });

  it('works the same for invoice card payments', async () => {
    const user = await signUpUser(app);
    const invoiceId = await sentInvoice(user, await customer(user), '20.00');
    const key = randomUUID();
    const pay = (paymentMethod: string) =>
      user.client.ok<any>(PAY_BY_CARD, {
        key,
        input: { invoiceId, amount: { amount: '20', currency: 'USD' }, paymentMethod },
      });
    expect((await pay('pm_card_declined')).payInvoiceByCard.userErrors).toEqual([
      { code: 'CARD_DECLINED', field: ['input', 'paymentMethod'] },
    ]);
    expect((await pay('pm_card_visa')).payInvoiceByCard.invoice.status).toBe('PAID');
  });
});
