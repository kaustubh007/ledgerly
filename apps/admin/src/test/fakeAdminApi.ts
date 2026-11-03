import { delay, HttpResponse } from 'msw';
import { graphql, type GraphQLQuery, type GraphQLResponseBody } from 'msw/graphql';

// A small in-memory admin API for component and route tests: MSW answers the real RTK Query
// requests, so the store, base query, cache and middleware under test are the real ones.

export interface FakeStaff {
  id: string;
  email: string;
  name: string;
  role: 'SUPPORT' | 'OPS';
}

export interface FakeOrg {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PRO' | 'BUSINESS';
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  suspendedAt: string | null;
  memberCount: number;
}

export const ACME_ID = 'a00000000000000000000001';
export const GLOBEX_ID = 'a00000000000000000000002';

type Body = GraphQLResponseBody<GraphQLQuery>;

/** Every fake answer is a GraphQL response body: `data`, `errors`, or both. */
const json = (body: Body) => HttpResponse.json<Body>(body);

const gqlError = (code: string, message = code) =>
  json({ data: null, errors: [{ message, extensions: { code } }] });

export function createFakeAdminApi() {
  const state = {
    /** The staff member the session cookie would identify; null = signed out. */
    session: null as FakeStaff | null,
    staff: { id: 's1', email: 'ops@ledgerly.example', name: 'Olu Ops', role: 'OPS' } as FakeStaff,
    password: 'correct password',
    enrolled: false,
    /** Make the next suspend fail with this GraphQL error code (after a delay). */
    failSuspendWith: null as string | null,
    orgs: [
      {
        id: ACME_ID,
        name: 'Acme',
        slug: 'acme',
        plan: 'FREE',
        status: 'ACTIVE',
        createdAt: '2026-10-01T09:00:00.000Z',
        suspendedAt: null,
        memberCount: 2,
      },
      {
        id: GLOBEX_ID,
        name: 'Globex',
        slug: 'globex',
        plan: 'PRO',
        status: 'SUSPENDED',
        createdAt: '2026-09-01T09:00:00.000Z',
        suspendedAt: '2026-10-20T09:00:00.000Z',
        memberCount: 1,
      },
    ] as FakeOrg[],
    audit: [] as { action: string; reason: string | null; orgId: string | null }[],
    /** Operation names in the order the API received them. */
    received: [] as { operation: string; variables: Record<string, unknown> }[],
  };

  const api = graphql.link('*/admin/graphql');
  const signedIn = () => state.session;
  const record = (operation: string, variables: Record<string, unknown>) => {
    state.received.push({ operation, variables });
  };
  const detail = (org: FakeOrg) => ({
    ...org,
    usage: {
      customers: 3,
      invoicesThisMonth: 7,
      seats: 2,
      customersLimit: org.plan === 'FREE' ? 5 : null,
      invoicesPerMonthLimit: org.plan === 'FREE' ? 10 : null,
      seatsLimit: org.plan === 'FREE' ? 2 : null,
    },
    outstanding: [
      { currency: 'EUR', amount: { amount: '80.00', currency: 'EUR' }, invoices: 1 },
      { currency: 'USD', amount: { amount: '1234.50', currency: 'USD' }, invoices: 2 },
    ],
    health: { lastActiveAt: '2026-11-02T10:00:00.000Z', overdueInvoices: 1 },
    members: [
      {
        userId: 'u1',
        name: 'Ada Owner',
        email: 'ada@acme.example',
        role: 'OWNER',
        activeSessions: 2,
      },
      {
        userId: 'u2',
        name: 'Bo Viewer',
        email: 'bo@acme.example',
        role: 'VIEWER',
        activeSessions: 0,
      },
    ],
  });
  const orgAction = async (
    name: string,
    input: { organizationId: string; reason: string },
    apply: (org: FakeOrg) => void,
  ) => {
    if (!signedIn()) return gqlError('UNAUTHENTICATED');
    if (signedIn()?.role !== 'OPS') return gqlError('FORBIDDEN');
    const org = state.orgs.find((o) => o.id === input.organizationId);
    if (!org)
      return json({
        data: {
          [name]: {
            organization: null,
            userErrors: [{ code: 'NOT_FOUND', message: '', field: [] }],
          },
        },
      });
    apply(org);
    state.audit.unshift({ action: name, reason: input.reason, orgId: org.id });
    return json({ data: { [name]: { organization: detail(org), userErrors: [] } } });
  };

  const handlers = [
    api.query('Me', () => json({ data: { me: state.session } })),

    api.mutation('SignIn', ({ variables }) => {
      const input = variables['input'] as { email: string; password: string };
      if (input.email !== state.staff.email || input.password !== state.password) {
        return json({
          data: {
            signIn: {
              next: null,
              enrolment: null,
              userErrors: [{ code: 'INVALID_CREDENTIALS', message: '', field: [] }],
            },
          },
        });
      }
      return json({
        data: {
          signIn: {
            next: state.enrolled ? 'VERIFY' : 'ENROL',
            enrolment: state.enrolled
              ? null
              : {
                  secret: 'JBSWY3DPEHPK3PXP',
                  otpauthUri: 'otpauth://totp/Ledgerly%20Admin:ops?secret=JBSWY3DPEHPK3PXP',
                },
            userErrors: [],
          },
        },
      });
    }),

    api.mutation('VerifyMfa', ({ variables }) => {
      const { code } = variables['input'] as { code: string };
      if (code !== '123456') {
        return json({
          data: {
            verifyMfa: {
              staff: null,
              recoveryCodes: null,
              userErrors: [{ code: 'INVALID_CODE', message: '', field: ['input', 'code'] }],
            },
          },
        });
      }
      const enrolling = !state.enrolled;
      state.enrolled = true;
      state.session = state.staff;
      return json({
        data: {
          verifyMfa: {
            staff: state.staff,
            recoveryCodes: enrolling ? ['k3m9-x2pq', 'a7c4-r8tw'] : null,
            userErrors: [],
          },
        },
      });
    }),

    api.mutation('SignOut', () => {
      state.session = null;
      return json({ data: { signOut: true } });
    }),

    api.query('Organizations', ({ variables }) => {
      record('Organizations', variables);
      if (!signedIn()) return gqlError('UNAUTHENTICATED');
      const search = (variables['search'] as string | null | undefined)?.toLowerCase();
      const status = variables['status'] as string | null | undefined;
      const rows = state.orgs.filter(
        (o) =>
          (!search || o.name.toLowerCase().startsWith(search) || o.slug.startsWith(search)) &&
          (!status || o.status === status),
      );
      return json({
        data: {
          organizations: {
            edges: rows.map((node) => ({ node })),
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });
    }),

    api.query('Organization', ({ variables }) => {
      record('Organization', variables);
      if (!signedIn()) return gqlError('UNAUTHENTICATED');
      const org = state.orgs.find((o) => o.id === variables['id']);
      return json({ data: { organization: org ? detail(org) : null } });
    }),

    api.mutation('SuspendOrganization', async ({ variables }) => {
      const input = variables['input'] as { organizationId: string; reason: string };
      if (state.failSuspendWith) {
        await delay(200);
        const code = state.failSuspendWith;
        state.failSuspendWith = null;
        return gqlError(code);
      }
      return orgAction('suspendOrganization', input, (org) => {
        org.status = 'SUSPENDED';
        org.suspendedAt = '2026-11-03T12:00:00.000Z';
      });
    }),

    api.mutation('UnsuspendOrganization', ({ variables }) =>
      orgAction(
        'unsuspendOrganization',
        variables['input'] as { organizationId: string; reason: string },
        (org) => {
          org.status = 'ACTIVE';
          org.suspendedAt = null;
        },
      ),
    ),

    api.mutation('ChangeOrganizationPlan', ({ variables }) => {
      const input = variables['input'] as {
        organizationId: string;
        reason: string;
        plan: FakeOrg['plan'];
      };
      return orgAction('changeOrganizationPlan', input, (org) => {
        org.plan = input.plan;
      });
    }),

    api.mutation('RevokeUserSessions', ({ variables }) => {
      if (signedIn()?.role !== 'OPS') return gqlError('FORBIDDEN');
      const input = variables['input'] as { reason: string; organizationId: string };
      state.audit.unshift({
        action: 'user.revokeSessions',
        reason: input.reason,
        orgId: input.organizationId,
      });
      return json({ data: { revokeUserSessions: { revoked: 2, userErrors: [] } } });
    }),

    api.query('AuditLog', ({ variables }) => {
      record('AuditLog', variables);
      if (!signedIn()) return gqlError('UNAUTHENTICATED');
      const filter = (variables['filter'] ?? {}) as { action?: string };
      const rows = state.audit.filter((e) => !filter.action || e.action === filter.action);
      return json({
        data: {
          auditLog: {
            edges: rows.map((e, i) => ({
              node: {
                id: `e${String(i)}`,
                at: '2026-11-03T12:00:00.000Z',
                action: e.action,
                organizationId: e.orgId,
                organizationName: state.orgs.find((o) => o.id === e.orgId)?.name ?? null,
                targetUserId: null,
                reason: e.reason,
                staff: { id: state.staff.id, email: state.staff.email },
              },
            })),
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });
    }),
  ];

  return { state, handlers };
}
