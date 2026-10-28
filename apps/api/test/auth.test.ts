import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REFRESH_GRACE_MS } from '../src/features/identity/auth.service.ts';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../src/features/identity/cookies.ts';
import { Session } from '../src/features/identity/session.model.ts';
import {
  lastEmail,
  SIGN_UP,
  signUpUser,
  startTestApp,
  tokenFrom,
  type TestApp,
} from './harness.ts';

const VIEWER = 'query { viewer { id email emailVerified sessions { id current } } }';
const LOG_IN = `mutation ($input: LogInInput!) { logIn(input: $input) { viewer { id } userErrors { code field } } }`;

let app: TestApp;
beforeAll(async () => {
  app = await startTestApp();
});
afterAll(() => app.close());

describe('sign-up', () => {
  it('creates the user, an organisation they own, a session, and a verification email', async () => {
    const { client, email, orgSlug } = await signUpUser(app, 'Ada');
    expect(client.cookies.has(ACCESS_COOKIE)).toBe(true);
    expect(client.cookies.get(REFRESH_COOKIE)?.path).toBe('/graphql/auth');
    expect(orgSlug).toMatch(/^ada-org/);
    const viewer = await client.ok<any>(VIEWER);
    expect(viewer.viewer).toMatchObject({ email, emailVerified: false });
    expect((await lastEmail(email, 'verify-email'))['link']).toContain('/verify-email?token=');
  });

  it('refuses a taken email and reports validation problems as userErrors', async () => {
    const { email } = await signUpUser(app);
    const client = app.client();
    const taken = await client.ok<any>(SIGN_UP, {
      input: {
        email: email.toUpperCase(),
        password: 'correct horse battery',
        name: 'X',
        organizationName: 'XY',
      },
    });
    expect(taken.signUp.userErrors).toEqual([{ code: 'EMAIL_TAKEN', field: ['input', 'email'] }]);

    const invalid = await client.ok<any>(SIGN_UP, {
      input: { email: 'nope', password: 'short', name: 'X', organizationName: 'XY' },
    });
    expect(invalid.signUp.userErrors.map((e: { code: string }) => e.code)).toEqual([
      'INVALID_EMAIL',
      'TOO_SMALL',
    ]);
    expect(client.cookies.size).toBe(0);
  });

  it('verifies the email with the emailed token, once', async () => {
    const { client, email } = await signUpUser(app);
    const token = tokenFrom((await lastEmail(email, 'verify-email'))['link']);
    const verify = `mutation ($t: String!) { verifyEmail(token: $t) { ok userErrors { code } } }`;
    expect((await client.ok<any>(verify, { t: token })).verifyEmail.ok).toBe(true);
    expect((await client.ok<any>(VIEWER)).viewer.emailVerified).toBe(true);
    expect((await client.ok<any>(verify, { t: token })).verifyEmail.userErrors).toEqual([
      { code: 'INVALID_TOKEN' },
    ]);
  });
});

describe('log-in', () => {
  it('logs in, and gives the same answer for a wrong password and an unknown email', async () => {
    const { email, password } = await signUpUser(app);
    const client = app.client();
    const wrong = await client.ok<any>(LOG_IN, { input: { email, password: 'wrong password!!' } });
    const unknown = await client.ok<any>(LOG_IN, {
      input: { email: 'nobody@example.com', password },
    });
    expect(wrong.logIn.userErrors).toEqual([{ code: 'INVALID_CREDENTIALS', field: [] }]);
    expect(unknown.logIn.userErrors).toEqual(wrong.logIn.userErrors);
    const right = await client.ok<any>(LOG_IN, { input: { email, password } });
    expect(right.logIn.viewer.id).toBeTruthy();
  });

  it('rate-limits attempts per email', async () => {
    const { email } = await signUpUser(app);
    const client = app.client();
    const codes: string[] = [];
    for (let i = 0; i < 11; i += 1) {
      const r = await client.ok<any>(LOG_IN, { input: { email, password: 'wrong password!!' } });
      codes.push(r.logIn.userErrors[0].code);
    }
    expect(codes.slice(0, 10).every((c) => c === 'INVALID_CREDENTIALS')).toBe(true);
    expect(codes[10]).toBe('RATE_LIMITED');
    app.clock.advance(15 * 60_000);
    const later = await client.ok<any>(LOG_IN, { input: { email, password: 'wrong password!!' } });
    expect(later.logIn.userErrors[0].code).toBe('INVALID_CREDENTIALS');
  });
});

describe('access and refresh tokens', () => {
  it('sends the refresh cookie only to the auth routes', async () => {
    const { client } = await signUpUser(app);
    const sent: string[] = [];
    const original = client.request.bind(client);
    client.request = (path, init) => {
      const header = new Headers(init?.headers).get('cookie');
      sent.push(`${path}:${String(header)}`);
      return original(path, init);
    };
    await client.gql(VIEWER);
    await client.refresh();
    // cookieHeader runs inside request(); inspect the jar's path logic directly as well.
    expect(client.cookies.get(REFRESH_COOKIE)?.path).toBe('/graphql/auth');
    expect(client['cookieHeader']('/graphql')).not.toContain(REFRESH_COOKIE);
    expect(client['cookieHeader']('/graphql/auth/refresh')).toContain(REFRESH_COOKIE);
  });

  it('expires the access token after 10 minutes; refresh issues a new one', async () => {
    const { client } = await signUpUser(app);
    app.clock.advance(10 * 60_000 + 1000);
    expect((await client.gql<any>(VIEWER)).data?.viewer).toBeNull();
    expect((await client.refresh()).status).toBe(204);
    expect((await client.ok<any>(VIEWER)).viewer).not.toBeNull();
  });

  it('rotates the refresh token on every use', async () => {
    const { client } = await signUpUser(app);
    const first = client.cookies.get(REFRESH_COOKIE)?.value;
    await client.refresh();
    const second = client.cookies.get(REFRESH_COOKIE)?.value;
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it('gives racing tabs the same successor within the grace window', async () => {
    const { client } = await signUpUser(app);
    const original = client.cookies.get(REFRESH_COOKIE)?.value ?? '';
    const tabA = app.client();
    const tabB = app.client();
    for (const tab of [tabA, tabB])
      tab.cookies.set(REFRESH_COOKIE, { value: original, path: '/graphql/auth' });

    expect((await tabA.refresh()).status).toBe(204);
    app.clock.advance(REFRESH_GRACE_MS - 1000);
    expect((await tabB.refresh()).status).toBe(204);
    expect(tabB.cookies.get(REFRESH_COOKIE)?.value).toBe(tabA.cookies.get(REFRESH_COOKIE)?.value);
  });

  it('treats reuse after the grace window as theft and revokes the session immediately', async () => {
    const { client } = await signUpUser(app);
    const stolen = client.cookies.get(REFRESH_COOKIE)?.value ?? '';
    await client.refresh(); // the legitimate user rotates
    app.clock.advance(REFRESH_GRACE_MS + 1000);

    const attacker = app.client();
    attacker.cookies.set(REFRESH_COOKIE, { value: stolen, path: '/graphql/auth' });
    const res = await attacker.refresh();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'SESSION_REVOKED' });

    // The legitimate user's still-valid access token stops working at once.
    expect((await client.gql<any>(VIEWER)).data?.viewer).toBeNull();
    expect((await client.refresh()).status).toBe(401);
  });

  it('detects reuse of tokens older than the previous one', async () => {
    const { client } = await signUpUser(app);
    const oldest = client.cookies.get(REFRESH_COOKIE)?.value ?? '';
    await client.refresh();
    app.clock.advance(REFRESH_GRACE_MS + 1000);
    await client.refresh();
    app.clock.advance(REFRESH_GRACE_MS + 1000);
    await client.refresh();

    const attacker = app.client();
    attacker.cookies.set(REFRESH_COOKIE, { value: oldest, path: '/graphql/auth' });
    expect((await attacker.refresh()).status).toBe(401);
    const session = await Session.findOne({ revokedReason: 'REFRESH_TOKEN_REUSE' })
      .sort({ updatedAt: -1 })
      .lean();
    expect(session).not.toBeNull();
  });

  it('refuses refresh and logout without the CSRF header, and unknown tokens', async () => {
    const { client } = await signUpUser(app);
    const noHeader = await client.request('/graphql/auth/refresh', { method: 'POST' });
    expect(noHeader.status).toBe(400);
    const stranger = app.client();
    stranger.cookies.set(REFRESH_COOKIE, { value: 'garbage', path: '/graphql/auth' });
    expect((await stranger.refresh()).status).toBe(401);
    expect((await app.client().refresh()).status).toBe(401);
  });
});

describe('sessions', () => {
  it('logs out: the session is revoked and cookies cleared', async () => {
    const { client } = await signUpUser(app);
    const access = client.cookies.get(ACCESS_COOKIE)?.value ?? '';
    expect((await client.logout()).status).toBe(204);
    expect(client.cookies.size).toBe(0);
    const replay = app.client();
    replay.cookies.set(ACCESS_COOKIE, { value: access, path: '/' });
    expect((await replay.gql<any>(VIEWER)).data?.viewer).toBeNull();
  });

  it('lists sessions and signs out other devices', async () => {
    const { email, password, client: laptop } = await signUpUser(app);
    const phone = app.client();
    await phone.ok(LOG_IN, { input: { email, password } });

    const sessions = (await laptop.ok<any>(VIEWER)).viewer.sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1);

    await laptop.ok('mutation { revokeOtherSessions { ok } }');
    expect((await phone.gql<any>(VIEWER)).data?.viewer).toBeNull();
    expect((await laptop.ok<any>(VIEWER)).viewer.sessions).toHaveLength(1);
  });

  it('cannot revoke someone else’s session', async () => {
    const a = await signUpUser(app);
    const b = await signUpUser(app);
    const bSession = (await b.client.ok<any>(VIEWER)).viewer.sessions[0].id;
    const r = await a.client.ok<any>(
      `mutation ($id: ID!) { revokeSession(id: $id) { ok userErrors { code } } }`,
      { id: bSession },
    );
    expect(r.revokeSession).toEqual({ ok: false, userErrors: [{ code: 'NOT_FOUND' }] });
    expect((await b.client.ok<any>(VIEWER)).viewer).not.toBeNull();
  });
});

describe('password reset', () => {
  it('always reports success, resets with the emailed token, and ends every session', async () => {
    const { client, email } = await signUpUser(app);
    const anon = app.client();
    const request = `mutation ($e: String!) { requestPasswordReset(email: $e) { ok } }`;
    expect((await anon.ok<any>(request, { e: 'nobody@example.com' })).requestPasswordReset.ok).toBe(
      true,
    );
    expect((await anon.ok<any>(request, { e: email })).requestPasswordReset.ok).toBe(true);

    const token = tokenFrom((await lastEmail(email, 'reset-password'))['link']);
    const reset = `mutation ($i: ResetPasswordInput!) { resetPassword(input: $i) { ok userErrors { code } } }`;
    const newPassword = 'a brand new passphrase';
    expect(
      (await anon.ok<any>(reset, { i: { token, password: newPassword } })).resetPassword.ok,
    ).toBe(true);
    expect((await client.gql<any>(VIEWER)).data?.viewer).toBeNull();

    const again = await anon.ok<any>(reset, { i: { token, password: newPassword } });
    expect(again.resetPassword.userErrors).toEqual([{ code: 'INVALID_TOKEN' }]);
    const login = await anon.ok<any>(LOG_IN, { input: { email, password: newPassword } });
    expect(login.logIn.viewer).not.toBeNull();
  });
});
