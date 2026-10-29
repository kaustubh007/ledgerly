import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  assignableRoles,
  can,
  checkMembershipChange,
  isRole,
  Permission,
  permissionsOf,
  Role,
  type MembershipChange,
} from './permissions.ts';

const roles = Object.values(Role);
const permissions = Object.values(Permission);

describe('permissions', () => {
  it('matches the documented grant table', () => {
    expect(Object.fromEntries(roles.map((r) => [r, permissionsOf(r)]))).toEqual({
      OWNER: [
        'books:read',
        'customers:write',
        'invoices:write',
        'payments:record',
        'members:manage',
        'organization:manage',
      ],
      ADMIN: [
        'books:read',
        'customers:write',
        'invoices:write',
        'payments:record',
        'members:manage',
      ],
      ACCOUNTANT: ['books:read', 'customers:write', 'invoices:write', 'payments:record'],
      VIEWER: ['books:read'],
    });
  });

  it('is monotonic: each role can do everything the role below it can', () => {
    const ladder: Role[] = ['VIEWER', 'ACCOUNTANT', 'ADMIN', 'OWNER'];
    for (const [i, lower] of ladder.entries()) {
      for (const higher of ladder.slice(i + 1)) {
        for (const p of permissions) {
          if (can(lower, p)) expect(can(higher, p)).toBe(true);
        }
      }
    }
  });

  it('recognises roles', () => {
    expect(isRole('ADMIN')).toBe(true);
    expect(isRole('admin')).toBe(false);
    expect(isRole('toString')).toBe(false);
  });
});

describe('checkMembershipChange', () => {
  const change = (c: Partial<MembershipChange>): MembershipChange => ({
    actorRole: 'OWNER',
    from: 'VIEWER',
    to: 'ACCOUNTANT',
    ownerCount: 1,
    ...c,
  });

  it.each<[Partial<MembershipChange>, ReturnType<typeof checkMembershipChange>]>([
    [{ actorRole: 'ACCOUNTANT' }, 'NOT_ALLOWED'],
    [{ actorRole: 'VIEWER', to: null }, 'NOT_ALLOWED'],
    [{ actorRole: 'ADMIN' }, null],
    [{ actorRole: 'ADMIN', to: null }, null],
    [{ actorRole: 'ADMIN', to: 'OWNER' }, 'OWNER_ONLY'],
    [{ actorRole: 'ADMIN', from: 'OWNER', to: 'ADMIN', ownerCount: 2 }, 'OWNER_ONLY'],
    [{ actorRole: 'ADMIN', from: 'OWNER', to: null, ownerCount: 2 }, 'OWNER_ONLY'],
    [{ to: 'OWNER' }, null],
    [{ from: 'OWNER', to: 'ADMIN', ownerCount: 2 }, null],
    [{ from: 'OWNER', to: 'ADMIN', ownerCount: 1 }, 'LAST_OWNER'],
    [{ from: 'OWNER', to: null, ownerCount: 1 }, 'LAST_OWNER'],
    [{ from: 'OWNER', to: 'OWNER', ownerCount: 1 }, null],
  ])('%o → %s', (partial, expected) => {
    expect(checkMembershipChange(change(partial))).toBe(expected);
  });

  it('never leaves an organisation without an owner', () => {
    const role = fc.constantFrom(...roles);
    fc.assert(
      fc.property(role, role, fc.option(role), fc.integer({ min: 1, max: 3 }), (a, f, t, n) => {
        const refusal = checkMembershipChange({ actorRole: a, from: f, to: t, ownerCount: n });
        const ownersAfter = n - (f === 'OWNER' ? 1 : 0) + (t === 'OWNER' ? 1 : 0);
        if (refusal === null) expect(ownersAfter).toBeGreaterThanOrEqual(1);
      }),
    );
  });
});

describe('assignableRoles', () => {
  it.each<[Role, Role[]]>([
    ['OWNER', ['OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER']],
    ['ADMIN', ['ADMIN', 'ACCOUNTANT', 'VIEWER']],
    ['ACCOUNTANT', []],
    ['VIEWER', []],
  ])('%s may assign %o', (actor, expected) => {
    expect(assignableRoles(actor)).toEqual(expected);
  });
});
