import { buildSchema } from 'graphql';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditEntry } from '../src/admin/audit/audit.model.ts';
import { Staff } from '../src/admin/staff/staff.model.ts';
import { STAFF_SESSION_COOKIE } from '../src/admin/staff/cookies.ts';
import { loadTypeDefs } from '../src/graphql/schema.ts';
import {
  createStaff,
  ME,
  SIGN_IN,
  signInStaff,
  totp,
  VERIFY_MFA,
  type SignedInStaff,
} from './admin-fixtures.ts';
import { CREATE_CUSTOMER, customer, sentInvoice } from './fixtures.ts';
import { signUpUser, startTestApp, type SignedUp, type TestApp } from './harness.ts';

// The Phase 5 gate (PLAN §5, ADR-0004), API side:
// - a tenant session is rejected at /admin/graphql, and a staff session at /graphql;
// - every admin resolver writes an audit entry (checked against the schema, like the leak suite);
// - unregistered models still throw under the platform scope (src/data/tenant-guard.test.ts);
// plus staff sign-in with mandatory TOTP, SUPPORT vs OPS, and suspension seen by tenants.

let app: TestApp;
let ops: SignedInStaff;
let support: SignedInStaff;
let tenant: SignedUp;
let other: SignedUp;

beforeAll(async () => {
  app = await startTestApp();
  ops = await signInStaff(app, 'OPS');
  support = await signInStaff(app, 'SUPPORT');
  tenant = await signUpUser(app, 'Tenant');
  other = await signUpUser(app, 'Other');
  const c = await customer(tenant);
  await sentInvoice(tenant, c, '120.00', 'USD', '2000-01-01');
  await sentInvoice(tenant, c, '80.00', 'EUR');
});
afterAll(() => app.close());

// Schema coverage: every Query and Mutation field must be exercised by a test that sees it
// write an audit entry. `me` only reads the caller's own record.
const NOT_AUDITED = new Set(['Query.me']);
const audited = new Set<string>();

/** Runs `fn` and asserts it appended at least one audit entry; records the field as covered. */
async function expectAudited<T>(field: string, fn: () => Promise<T>): Promise<T> {
  const before = await AuditEntry.countDocuments().exec();
  const result = await fn();
  expect(await AuditEntry.countDocuments().exec(), `${field} wrote no audit entry`).toBeGreaterThan(
    before,
  );
  audited.add(field);
  return result;
}

const latestAudit = () => AuditEntry.findOne().sort({ createdAt: -1, _id: -1 }).lean().exec();

const ORG_DETAIL = /* GraphQL */ `
  query ($id: ID!) {
    organization(id: $id) {
      id
      name
      plan
      status
      memberCount
      usage {
        customers
        invoicesThisMonth
        seats
        customersLimit
        seatsLimit
        invoicesPerMonthLimit
      }
      outstanding {
        currency
        amount {
          amount
          currency
        }
        invoices
      }
      health {
        lastActiveAt
        overdueInvoices
      }
      members {
        userId
        email
        role
        activeSessions
      }
    }
  }
`;

const SUSPEND = `mutation ($input: OrganizationActionInput!) { suspendOrganization(input: $input) { organization { id status suspendedAt } userErrors { code field } } }`;
const UNSUSPEND = `mutation ($input: OrganizationActionInput!) { unsuspendOrganization(input: $input) { organization { id status } userErrors { code field } } }`;
const CHANGE_PLAN = `mutation ($input: ChangeOrganizationPlanInput!) { changeOrganizationPlan(input: $input) { organization { plan } userErrors { code field } } }`;
const REVOKE = `mutation ($input: RevokeUserSessionsInput!) { revokeUserSessions(input: $input) { revoked userErrors { code field } } }`;

describe('staff sign-in: password, then TOTP, always', () => {
  it('enrols an authenticator on the first sign-in, with cookies the browser cannot read', async () => {
    const { email, password } = await createStaff('SUPPORT');
    const client = app.client();
    const step1 = await client.request('/admin/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: SIGN_IN, variables: { input: { email, password } } }),
    });
    const body = (await step1.json()) as any;
    expect(body.data.signIn.next).toBe('ENROL');
    expect(body.data.signIn.enrolment.otpauthUri).toMatch(/^otpauth:\/\/totp\/Ledgerly%20Admin:/);
    expect(step1.headers.getSetCookie().join(';')).toMatch(
      /__Host-adm-mfa=.*HttpOnly.*Secure.*SameSite=Strict/i,
    );
    // Signed in only after the code: the password alone is not a session.
    expect((await client.adminOk(ME)).me).toBeNull();

    const step2 = await client.request('/admin/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: VERIFY_MFA,
        variables: { code: await totp(app, body.data.signIn.enrolment.secret) },
      }),
    });
    const verified = (await step2.json()) as any;
    expect(verified.data.verifyMfa.recoveryCodes).toHaveLength(10);
    const session = step2.headers
      .getSetCookie()
      .find((c) => c.startsWith(`${STAFF_SESSION_COOKIE}=`));
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/Secure/i);
    expect(session).toMatch(/SameSite=Strict/i);
    expect((await client.adminOk(ME)).me).toMatchObject({ email, role: 'SUPPORT' });
    const stored = await Staff.findOne({ email }).lean().exec();
    expect(stored?.totpSecret).not.toContain(body.data.signIn.enrolment.secret); // encrypted at rest
  });

  it('refuses a wrong password and an unknown email the same way, and audits both', async () => {
    const wrong = await app
      .client()
      .adminOk(SIGN_IN, { input: { email: ops.email, password: 'not the password' } });
    const unknown = await app.client().adminOk(SIGN_IN, {
      input: { email: 'nobody@ledgerly.example', password: 'whatever it is' },
    });
    expect(wrong.signIn.userErrors).toEqual([{ code: 'INVALID_CREDENTIALS', field: [] }]);
    expect(unknown.signIn).toEqual(wrong.signIn);
    expect((await latestAudit())?.action).toBe('staff.signIn.failed');
  });

  it('asks for a code, accepts it once, and refuses the same code again (replay)', async () => {
    const client = app.client();
    const step1 = await client.adminOk(SIGN_IN, {
      input: { email: ops.email, password: ops.password },
    });
    expect(step1.signIn).toMatchObject({ next: 'VERIFY', enrolment: null });
    expect((await client.adminOk(VERIFY_MFA, { code: '000000' })).verifyMfa.userErrors).toEqual([
      { code: 'INVALID_CODE', field: ['input', 'code'] },
    ]);
    expect((await latestAudit())?.action).toBe('staff.mfa.failed');
    const code = await totp(app, ops.secret);
    expect((await client.adminOk(VERIFY_MFA, { code })).verifyMfa.staff.email).toBe(ops.email);

    const again = app.client();
    await again.adminOk(SIGN_IN, { input: { email: ops.email, password: ops.password } });
    expect((await again.adminOk(VERIFY_MFA, { code })).verifyMfa.userErrors[0].code).toBe(
      'INVALID_CODE',
    );
    app.clock.advance(30_000);
    expect(
      (await again.adminOk(VERIFY_MFA, { code: await totp(app, ops.secret) })).verifyMfa.staff,
    ).not.toBeNull();
  });

  it('accepts each recovery code once', async () => {
    const staff = await signInStaff(app, 'SUPPORT');
    const [code] = staff.recoveryCodes;
    const first = app.client();
    await first.adminOk(SIGN_IN, { input: { email: staff.email, password: staff.password } });
    expect(
      (await first.adminOk(VERIFY_MFA, { code: code?.toUpperCase() })).verifyMfa.staff,
    ).not.toBeNull();
    const second = app.client();
    await second.adminOk(SIGN_IN, { input: { email: staff.email, password: staff.password } });
    expect((await second.adminOk(VERIFY_MFA, { code })).verifyMfa.userErrors[0].code).toBe(
      'INVALID_CODE',
    );
  });

  it('allows five attempts per challenge, then asks for the password again', async () => {
    const client = app.client();
    await client.adminOk(SIGN_IN, { input: { email: support.email, password: support.password } });
    for (let i = 0; i < 5; i += 1) await client.adminOk(VERIFY_MFA, { code: '111111' });
    const sixth = await client.adminOk(VERIFY_MFA, { code: await totp(app, support.secret) });
    expect(sixth.verifyMfa.userErrors[0].code).toBe('MFA_EXPIRED');
  });

  it('expires a challenge after 5 minutes', async () => {
    const client = app.client();
    await client.adminOk(SIGN_IN, { input: { email: support.email, password: support.password } });
    app.clock.advance(5 * 60_000 + 1);
    expect(
      (await client.adminOk(VERIFY_MFA, { code: await totp(app, support.secret) })).verifyMfa
        .userErrors[0].code,
    ).toBe('MFA_EXPIRED');
  });
});

describe('separate identities: neither session works on the other API', () => {
  it('rejects a tenant session at /admin/graphql', async () => {
    expect((await tenant.client.adminOk(ME)).me).toBeNull();
    const r = await tenant.client.adminGql('query { organizations { edges { node { id } } } }');
    expect(r.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a staff session at /graphql', async () => {
    expect((await ops.client.ok<any>('query { viewer { id } }')).viewer).toBeNull();
    const r = await ops.client.gql(
      'query { organization { id } }',
      {},
      { 'x-org': tenant.orgSlug },
    );
    expect(r.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('has no tenant business data types at all (data minimisation)', () => {
    const types = Object.keys(buildSchema(loadTypeDefs('admin')).getTypeMap());
    for (const name of ['Invoice', 'Customer', 'Payment', 'InvoiceLine', 'Viewer']) {
      expect(types).not.toContain(name);
    }
  });
});

describe('reading organisations (SUPPORT and OPS)', () => {
  it('searches by name or slug prefix, newest first', async () => {
    const r = await expectAudited('Query.organizations', () =>
      support.client.adminOk(
        `query { organizations(search: "tenant") { edges { node { id name slug status memberCount } } } }`,
      ),
    );
    expect(r.organizations.edges.map((e: any) => e.node.id)).toContain(tenant.orgId);
    expect(r.organizations.edges.map((e: any) => e.node.id)).not.toContain(other.orgId);
    expect((await latestAudit())?.details).toEqual({ search: 'tenant', status: null });
  });

  it('shows counts, per-currency totals and health, never invoice contents', async () => {
    const r = await expectAudited('Query.organization', () =>
      support.client.adminOk(ORG_DETAIL, { id: tenant.orgId }),
    );
    expect(r.organization).toMatchObject({
      plan: 'FREE',
      status: 'ACTIVE',
      memberCount: 1,
      usage: { customers: 1, invoicesThisMonth: 2, seats: 1, customersLimit: 5, seatsLimit: 2 },
      outstanding: [
        { currency: 'EUR', amount: { amount: '80.00', currency: 'EUR' }, invoices: 1 },
        { currency: 'USD', amount: { amount: '120.00', currency: 'USD' }, invoices: 1 },
      ],
      health: { overdueInvoices: 1 },
      members: [{ userId: tenant.userId, email: tenant.email, role: 'OWNER', activeSessions: 1 }],
    });
    expect(r.organization.health.lastActiveAt).not.toBeNull();
    const entry = await latestAudit();
    expect(entry).toMatchObject({ action: 'organization.view', reason: null });
    expect(entry?.orgId?.toString()).toBe(tenant.orgId);
    expect(entry?.staffId?.toString()).toBe(support.staffId);
  });

  it('returns null for an unknown organisation, and still audits the attempt', async () => {
    const r = await support.client.adminOk(ORG_DETAIL, { id: new Types.ObjectId().toString() });
    expect(r.organization).toBeNull();
    expect((await latestAudit())?.action).toBe('organization.view');
  });
});

describe('OPS actions: role, reason, effect, audit', () => {
  const reason = 'Chargeback dispute, ticket #4521';

  it('refuses SUPPORT staff (FORBIDDEN) and changes nothing', async () => {
    const r = await support.client.adminGql(SUSPEND, {
      input: { organizationId: tenant.orgId, reason },
    });
    expect(r.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    const org = await support.client.adminOk(ORG_DETAIL, { id: tenant.orgId });
    expect(org.organization.status).toBe('ACTIVE');
  });

  it('requires a reason of at least 10 characters', async () => {
    const r = await ops.client.adminOk(SUSPEND, {
      input: { organizationId: tenant.orgId, reason: 'because' },
    });
    expect(r.suspendOrganization.userErrors).toEqual([
      { code: 'TOO_SMALL', field: ['input', 'reason'] },
    ]);
  });

  it('suspends: the org is read-only for its members from their next request', async () => {
    const r = await expectAudited('Mutation.suspendOrganization', () =>
      ops.client.adminOk(SUSPEND, { input: { organizationId: tenant.orgId, reason } }),
    );
    expect(r.suspendOrganization.organization.status).toBe('SUSPENDED');
    const entry = await latestAudit();
    expect(entry).toMatchObject({ action: 'organization.suspend', reason });
    expect(entry?.staffId?.toString()).toBe(ops.staffId);

    // Tenant side: reads work, the org says it is suspended, every tenant mutation is refused.
    const read = await tenant.client.ok<any>(
      'query { organization { suspended } customers { edges { node { id } } } }',
    );
    expect(read.organization.suspended).toBe(true);
    expect(read.customers.edges).toHaveLength(1);
    const write = await tenant.client.gql(CREATE_CUSTOMER, {
      input: { name: 'Blocked', defaultCurrency: 'USD', documentLocale: 'en' },
    });
    expect(write.errors?.[0]?.extensions?.code).toBe('ORG_SUSPENDED');
    // Mutations about the user's own account still work.
    expect(
      (await tenant.client.ok<any>('mutation { revokeOtherSessions { ok } }')).revokeOtherSessions
        .ok,
    ).toBe(true);
    // Other organisations are untouched.
    expect(
      (await other.client.ok<any>('query { organization { suspended } }')).organization.suspended,
    ).toBe(false);

    const twice = await ops.client.adminOk(SUSPEND, {
      input: { organizationId: tenant.orgId, reason },
    });
    expect(twice.suspendOrganization.userErrors[0].code).toBe('ALREADY_SUSPENDED');
  });

  it('unsuspends', async () => {
    const r = await expectAudited('Mutation.unsuspendOrganization', () =>
      ops.client.adminOk(UNSUSPEND, {
        input: { organizationId: tenant.orgId, reason: 'Dispute resolved, ticket #4521' },
      }),
    );
    expect(r.unsuspendOrganization.organization.status).toBe('ACTIVE');
    const write = await tenant.client.ok<any>(CREATE_CUSTOMER, {
      input: { name: 'Allowed again', defaultCurrency: 'USD', documentLocale: 'en' },
    });
    expect(write.createCustomer.userErrors).toEqual([]);
  });

  it('changes the plan without charging, and the tenant sees it', async () => {
    const r = await expectAudited('Mutation.changeOrganizationPlan', () =>
      ops.client.adminOk(CHANGE_PLAN, {
        input: {
          organizationId: tenant.orgId,
          plan: 'PRO',
          reason: 'Goodwill upgrade after outage',
        },
      }),
    );
    expect(r.changeOrganizationPlan.organization.plan).toBe('PRO');
    expect((await latestAudit())?.details).toEqual({ from: 'FREE', to: 'PRO' });
    expect(
      (await tenant.client.ok<any>('query { organization { plan { code } } }')).organization.plan
        .code,
    ).toBe('PRO');
  });

  it('revokes a member’s sessions everywhere, and only for a member of that organisation', async () => {
    const notMember = await ops.client.adminOk(REVOKE, {
      input: {
        organizationId: tenant.orgId,
        userId: other.userId,
        reason: 'Suspected account takeover',
      },
    });
    expect(notMember.revokeUserSessions.userErrors[0].code).toBe('NOT_FOUND');

    const r = await expectAudited('Mutation.revokeUserSessions', () =>
      ops.client.adminOk(REVOKE, {
        input: {
          organizationId: tenant.orgId,
          userId: tenant.userId,
          reason: 'Suspected account takeover',
        },
      }),
    );
    expect(r.revokeUserSessions.revoked).toBeGreaterThan(0);
    expect((await latestAudit())?.targetUserId?.toString()).toBe(tenant.userId);
    expect((await tenant.client.ok<any>('query { viewer { id } }')).viewer).toBeNull();
  });
});

describe('the audit log', () => {
  it('lists entries newest first, filtered by organisation, with the staff member and reason', async () => {
    const r = await expectAudited('Query.auditLog', () =>
      support.client.adminOk(
        `query ($f: AuditLogFilter) { auditLog(filter: $f, first: 50) { edges { node { action reason organizationId organizationName staff { email } } } } }`,
        { f: { organizationId: tenant.orgId } },
      ),
    );
    const actions = r.auditLog.edges.map((e: any) => e.node.action);
    expect(actions.slice(0, 2)).toEqual(['user.revokeSessions', 'organization.changePlan']);
    expect(actions).toContain('organization.suspend');
    const suspend = r.auditLog.edges.find(
      (e: any) => e.node.action === 'organization.suspend',
    ).node;
    expect(suspend).toMatchObject({
      reason: 'Chargeback dispute, ticket #4521',
      organizationName: 'Tenant Org',
      staff: { email: ops.email },
    });
    expect(r.auditLog.edges.every((e: any) => e.node.organizationId === tenant.orgId)).toBe(true);
  });
});

describe('staff sessions: 8 hours absolute, 30 minutes idle', () => {
  // Last: these move the test clock by hours.

  it('signs out, and audits it', async () => {
    const staff = await signInStaff(app, 'SUPPORT');
    await expectAudited('Mutation.signOut', () => staff.client.adminOk('mutation { signOut }'));
    expect((await staff.client.adminOk(ME)).me).toBeNull();
  });

  it('covers signIn and verifyMfa', async () => {
    const { email, password } = await createStaff('SUPPORT');
    const client = app.client();
    const step1 = await expectAudited('Mutation.signIn', () =>
      client.adminOk(SIGN_IN, { input: { email, password } }),
    );
    const code = await totp(app, step1.signIn.enrolment.secret);
    await expectAudited('Mutation.verifyMfa', () => client.adminOk(VERIFY_MFA, { code }));
  });

  it('ends after 30 minutes without a request, but not while in use', async () => {
    const staff = await signInStaff(app, 'SUPPORT');
    for (let i = 0; i < 3; i += 1) {
      app.clock.advance(20 * 60_000);
      expect(
        (await staff.client.adminOk(ME)).me,
        `after ${String((i + 1) * 20)} min of use`,
      ).not.toBeNull();
    }
    app.clock.advance(31 * 60_000);
    expect((await staff.client.adminOk(ME)).me).toBeNull();
  });

  it('ends 8 hours after sign-in, however active', async () => {
    const staff = await signInStaff(app, 'SUPPORT');
    for (let i = 0; i < 16; i += 1) {
      app.clock.advance(29 * 60_000);
      await staff.client.adminOk(ME);
    }
    // 16 × 29 min = 7 h 44 min: still in.
    expect((await staff.client.adminOk(ME)).me).not.toBeNull();
    app.clock.advance(20 * 60_000);
    expect((await staff.client.adminOk(ME)).me).toBeNull();
  });

  it('ends at once when the staff member is disabled', async () => {
    const staff = await signInStaff(app, 'OPS');
    await Staff.updateOne({ email: staff.email }, { disabledAt: new Date() }).exec();
    expect((await staff.client.adminOk(ME)).me).toBeNull();
  });
});

describe('every admin resolver writes an audit entry', () => {
  it('covers every Query and Mutation field in the admin schema', () => {
    const schema = buildSchema(loadTypeDefs('admin'));
    const all = [
      ...Object.keys(schema.getQueryType()?.getFields() ?? {}).map((f) => `Query.${f}`),
      ...Object.keys(schema.getMutationType()?.getFields() ?? {}).map((f) => `Mutation.${f}`),
    ];
    // A new admin field fails here until a test sees it write an audit entry.
    expect(all.filter((f) => !audited.has(f) && !NOT_AUDITED.has(f))).toEqual([]);
  });
});
