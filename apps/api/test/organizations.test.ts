import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  lastEmail,
  signUpUser,
  startTestApp,
  tokenFrom,
  type SignedUp,
  type TestApp,
} from './harness.ts';
import { upgrade } from './fixtures.ts';

const INVITE = `mutation ($email: String!, $role: Role!) { inviteMember(email: $email, role: $role) { invitation { id email role } userErrors { code field } } }`;
const ACCEPT = `mutation ($token: String!) { acceptInvitation(token: $token) { organization { slug } userErrors { code } } }`;
const MEMBERS = `query { organization { slug viewerRole members { userId email role } } }`;
const CHANGE = `mutation ($u: ID!, $r: Role!) { changeMemberRole(userId: $u, role: $r) { member { role } userErrors { code } } }`;
const REMOVE = `mutation ($u: ID!) { removeMember(userId: $u) { ok userErrors { code } } }`;

let app: TestApp;
beforeAll(async () => {
  app = await startTestApp();
});
afterAll(() => app.close());

/** Invites `invitee` into `owner`'s organisation with `role` and accepts. */
async function join(owner: SignedUp, invitee: SignedUp, role: string): Promise<void> {
  await owner.client.ok(INVITE, { email: invitee.email, role });
  const token = tokenFrom((await lastEmail(invitee.email, 'invitation'))['link']);
  const accepted = await invitee.client.ok<any>(ACCEPT, { token });
  expect(accepted.acceptInvitation.userErrors).toEqual([]);
}

describe('organisation context', () => {
  it('needs a signed-in member: anonymous is UNAUTHENTICATED, a stranger is FORBIDDEN', async () => {
    const owner = await signUpUser(app);
    const anon = app.client();
    anon.org = owner.orgSlug;
    expect((await anon.gql(MEMBERS)).errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');

    const stranger = await signUpUser(app);
    stranger.client.org = owner.orgSlug;
    expect((await stranger.client.gql(MEMBERS)).errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    stranger.client.org = 'no-such-org';
    expect((await stranger.client.gql(MEMBERS)).errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('lets one user work in two organisations, selected per request', async () => {
    const user = await signUpUser(app, 'Multi');
    const created = await user.client.ok<any>(
      `mutation { createOrganization(name: "Second Co") { organization { slug } } }`,
    );
    const second = created.createOrganization.organization.slug;
    const viewer = await user.client.ok<any>(
      'query { viewer { memberships { organization { slug } role } } }',
    );
    expect(viewer.viewer.memberships.map((m: any) => m.organization.slug)).toEqual([
      user.orgSlug,
      second,
    ]);

    const firstOrg = await user.client.gql<any>(MEMBERS, {}, { 'x-org': user.orgSlug });
    const secondOrg = await user.client.gql<any>(MEMBERS, {}, { 'x-org': second });
    expect(firstOrg.data.organization.slug).toBe(user.orgSlug);
    expect(secondOrg.data.organization.slug).toBe(second);
  });
});

describe('invitations', () => {
  it('invites by email; the invitee accepts with the emailed token and gets the role', async () => {
    const owner = await signUpUser(app);
    const invitee = await signUpUser(app);
    await join(owner, invitee, 'ACCOUNTANT');
    invitee.client.org = owner.orgSlug;
    const me = await invitee.client.ok<any>(MEMBERS.replace('members { userId email role }', ''));
    expect(me.organization.viewerRole).toBe('ACCOUNTANT');
  });

  it('refuses an invitation for a different email, a reused token, and an existing member', async () => {
    const owner = await signUpUser(app);
    const invitee = await signUpUser(app);
    const other = await signUpUser(app);
    await owner.client.ok(INVITE, { email: invitee.email, role: 'VIEWER' });
    const token = tokenFrom((await lastEmail(invitee.email, 'invitation'))['link']);

    expect((await other.client.ok<any>(ACCEPT, { token })).acceptInvitation.userErrors).toEqual([
      { code: 'EMAIL_MISMATCH' },
    ]);
    expect((await invitee.client.ok<any>(ACCEPT, { token })).acceptInvitation.userErrors).toEqual(
      [],
    );
    expect((await invitee.client.ok<any>(ACCEPT, { token })).acceptInvitation.userErrors).toEqual([
      { code: 'INVALID_TOKEN' },
    ]);
    const again = await owner.client.ok<any>(INVITE, { email: invitee.email, role: 'VIEWER' });
    expect(again.inviteMember.userErrors).toEqual([{ code: 'ALREADY_MEMBER', field: ['email'] }]);
  });

  it('expires after seven days, and re-inviting invalidates the earlier link', async () => {
    const owner = await signUpUser(app);
    const invitee = await signUpUser(app);
    await owner.client.ok(INVITE, { email: invitee.email, role: 'VIEWER' });
    const first = tokenFrom((await lastEmail(invitee.email, 'invitation'))['link']);
    await owner.client.ok(INVITE, { email: invitee.email, role: 'ADMIN' });
    const second = tokenFrom((await lastEmail(invitee.email, 'invitation'))['link']);
    expect(
      (await invitee.client.ok<any>(ACCEPT, { token: first })).acceptInvitation.userErrors,
    ).toEqual([{ code: 'INVALID_TOKEN' }]);
    app.clock.advance(7 * 24 * 60 * 60 * 1000 + 1000);
    await invitee.client.refresh(); // the access token expired too; a browser would refresh
    expect(
      (await invitee.client.ok<any>(ACCEPT, { token: second })).acceptInvitation.userErrors,
    ).toEqual([{ code: 'INVALID_TOKEN' }]);
  });

  it('is limited by role: VIEWER and ACCOUNTANT cannot invite, ADMIN cannot invite an OWNER', async () => {
    const owner = await signUpUser(app);
    await upgrade(owner); // FREE has two seats
    const viewer = await signUpUser(app);
    const admin = await signUpUser(app);
    await join(owner, viewer, 'VIEWER');
    await join(owner, admin, 'ADMIN');
    viewer.client.org = owner.orgSlug;
    admin.client.org = owner.orgSlug;
    expect(
      (await viewer.client.gql(INVITE, { email: 'x@example.com', role: 'VIEWER' })).errors?.[0]
        ?.extensions?.code,
    ).toBe('FORBIDDEN');
    const r = await admin.client.ok<any>(INVITE, { email: 'x@example.com', role: 'OWNER' });
    expect(r.inviteMember.userErrors).toEqual([{ code: 'OWNER_ONLY', field: ['role'] }]);
  });
});

describe('roles', () => {
  it('protects the owner role and the last owner', async () => {
    const owner = await signUpUser(app);
    await upgrade(owner); // FREE has two seats
    const admin = await signUpUser(app);
    const member = await signUpUser(app);
    await join(owner, admin, 'ADMIN');
    await join(owner, member, 'VIEWER');
    admin.client.org = owner.orgSlug;

    expect(
      (await admin.client.ok<any>(CHANGE, { u: member.userId, r: 'ACCOUNTANT' })).changeMemberRole
        .member.role,
    ).toBe('ACCOUNTANT');
    expect(
      (await admin.client.ok<any>(CHANGE, { u: owner.userId, r: 'ADMIN' })).changeMemberRole
        .userErrors,
    ).toEqual([{ code: 'OWNER_ONLY' }]);
    expect(
      (await admin.client.ok<any>(REMOVE, { u: owner.userId })).removeMember.userErrors,
    ).toEqual([{ code: 'OWNER_ONLY' }]);
    expect(
      (await owner.client.ok<any>(CHANGE, { u: owner.userId, r: 'ADMIN' })).changeMemberRole
        .userErrors,
    ).toEqual([{ code: 'LAST_OWNER' }]);
    expect(
      (await owner.client.ok<any>(REMOVE, { u: owner.userId })).removeMember.userErrors,
    ).toEqual([{ code: 'LAST_OWNER' }]);
  });

  it('applies a role change on the very next request (roles are not in the token)', async () => {
    const owner = await signUpUser(app);
    const member = await signUpUser(app);
    await join(owner, member, 'ADMIN');
    member.client.org = owner.orgSlug;
    expect((await member.client.gql(MEMBERS)).errors).toBeUndefined();

    await owner.client.ok(CHANGE, { u: member.userId, r: 'VIEWER' });
    expect((await member.client.gql(MEMBERS)).errors?.[0]?.extensions?.code).toBe('FORBIDDEN');

    await owner.client.ok(REMOVE, { u: member.userId });
    expect(
      (await member.client.gql('query { organization { slug } }')).errors?.[0]?.extensions?.code,
    ).toBe('FORBIDDEN');
  });
});
