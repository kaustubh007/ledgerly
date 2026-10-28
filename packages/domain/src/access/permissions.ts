export const Role = {
  Owner: 'OWNER',
  Admin: 'ADMIN',
  Accountant: 'ACCOUNTANT',
  Viewer: 'VIEWER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Permission = {
  ReadBooks: 'books:read', // customers, invoices, payments, dashboard
  WriteCustomers: 'customers:write',
  WriteInvoices: 'invoices:write', // draft, edit lines, send, void
  RecordPayments: 'payments:record',
  ManageMembers: 'members:manage',
  ManageOrganization: 'organization:manage',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

/** Who may do what. Read this table, not the resolvers, to answer "can an X do Y?". */
const GRANTS: Readonly<Record<Role, readonly Permission[]>> = {
  OWNER: [
    'books:read',
    'customers:write',
    'invoices:write',
    'payments:record',
    'members:manage',
    'organization:manage',
  ],
  ADMIN: ['books:read', 'customers:write', 'invoices:write', 'payments:record', 'members:manage'],
  ACCOUNTANT: ['books:read', 'customers:write', 'invoices:write', 'payments:record'],
  VIEWER: ['books:read'],
};

export function permissionsOf(role: Role): readonly Permission[] {
  return GRANTS[role];
}

export function can(role: Role, permission: Permission): boolean {
  return GRANTS[role].includes(permission);
}

export function isRole(value: string): value is Role {
  return Object.hasOwn(GRANTS, value);
}

export type MembershipChangeRefusal =
  | 'NOT_ALLOWED' // actor lacks members:manage
  | 'OWNER_ONLY' // only an owner may grant, change or remove the owner role
  | 'LAST_OWNER'; // an organisation must keep at least one owner

export interface MembershipChange {
  readonly actorRole: Role;
  /** The target's current role. */
  readonly from: Role;
  /** The target's new role, or `null` to remove them from the organisation. */
  readonly to: Role | null;
  /** How many owners the organisation has right now, including the target if they are one. */
  readonly ownerCount: number;
}

/**
 * Decides whether a role change or removal is allowed. Applies equally to changing someone
 * else and to changing yourself (leaving an organisation is a removal of yourself).
 */
export function checkMembershipChange(change: MembershipChange): MembershipChangeRefusal | null {
  const { actorRole, from, to, ownerCount } = change;
  if (!can(actorRole, 'members:manage')) return 'NOT_ALLOWED';
  const touchesOwner = from === 'OWNER' || to === 'OWNER';
  if (touchesOwner && actorRole !== 'OWNER') return 'OWNER_ONLY';
  if (from === 'OWNER' && to !== 'OWNER' && ownerCount <= 1) return 'LAST_OWNER';
  return null;
}

/** Roles an actor may assign when inviting someone. */
export function assignableRoles(actorRole: Role): readonly Role[] {
  if (!can(actorRole, 'members:manage')) return [];
  return actorRole === 'OWNER'
    ? ['OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER']
    : ['ADMIN', 'ACCOUNTANT', 'VIEWER'];
}
