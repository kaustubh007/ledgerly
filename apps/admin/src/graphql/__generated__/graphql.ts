/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
export type AuditLogFilter = {
  /** Exact action, e.g. `organization.suspend`. */
  action?: string | null | undefined;
  organizationId?: string | null | undefined;
  staffId?: string | null | undefined;
};

export type ChangeOrganizationPlanInput = {
  organizationId: string;
  plan: PlanCode;
  reason: string;
};

export type MfaStep =
  /** First sign-in: add the secret to an authenticator app, then enter a code. */
  | 'ENROL'
  /** Enter a code from the authenticator app (or a recovery code). */
  | 'VERIFY';

export type OrganizationActionInput = {
  organizationId: string;
  /** Why: at least 10 characters. Written to the audit log. */
  reason: string;
};

export type OrganizationStatus =
  | 'ACTIVE'
  /** Read-only for its members: every tenant mutation returns ORG_SUSPENDED. */
  | 'SUSPENDED';

export type PlanCode =
  | 'BUSINESS'
  | 'FREE'
  | 'PRO';

export type RevokeUserSessionsInput = {
  organizationId: string;
  reason: string;
  /** Must be a member of the organisation. */
  userId: string;
};

export type StaffRole =
  /** Everything SUPPORT can do, plus suspend, change plan and revoke sessions. */
  | 'OPS'
  /** Reads: search organisations, view them, read the audit log. */
  | 'SUPPORT';

export type StaffSignInInput = {
  email: string;
  password: string;
};

export type VerifyMfaInput = {
  /** A 6-digit authenticator code, or a recovery code such as `k3m9-x2pq`. */
  code: string;
};

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { me: { id: string, email: string, name: string, role: StaffRole } | null };

export type SignInMutationVariables = Exact<{
  input: StaffSignInInput;
}>;


export type SignInMutation = { signIn: { next: MfaStep | null, enrolment: { secret: string, otpauthUri: string } | null, userErrors: Array<{ code: string, message: string, field: Array<string> | null }> } };

export type VerifyMfaMutationVariables = Exact<{
  input: VerifyMfaInput;
}>;


export type VerifyMfaMutation = { verifyMfa: { recoveryCodes: Array<string> | null, staff: { id: string, email: string, name: string, role: StaffRole } | null, userErrors: Array<{ code: string, message: string, field: Array<string> | null }> } };

export type SignOutMutationVariables = Exact<{ [key: string]: never; }>;


export type SignOutMutation = { signOut: boolean };

export type OrganizationsQueryVariables = Exact<{
  search?: string | null | undefined;
  status?: OrganizationStatus | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type OrganizationsQuery = { organizations: { edges: Array<{ node: { id: string, name: string, slug: string, plan: PlanCode, status: OrganizationStatus, createdAt: string, memberCount: number } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type OrganizationQueryVariables = Exact<{
  id: string;
}>;


export type OrganizationQuery = { organization: { id: string, name: string, slug: string, plan: PlanCode, status: OrganizationStatus, createdAt: string, suspendedAt: string | null, memberCount: number, usage: { customers: number, invoicesThisMonth: number, seats: number, customersLimit: number | null, invoicesPerMonthLimit: number | null, seatsLimit: number | null }, outstanding: Array<{ currency: string, invoices: number, amount: { amount: string, currency: string } }>, health: { lastActiveAt: string | null, overdueInvoices: number }, members: Array<{ userId: string, name: string, email: string, role: string, activeSessions: number }> } | null };

export type SuspendOrganizationMutationVariables = Exact<{
  input: OrganizationActionInput;
}>;


export type SuspendOrganizationMutation = { suspendOrganization: { organization: { id: string, status: OrganizationStatus, suspendedAt: string | null } | null, userErrors: Array<{ code: string, message: string, field: Array<string> | null }> } };

export type UnsuspendOrganizationMutationVariables = Exact<{
  input: OrganizationActionInput;
}>;


export type UnsuspendOrganizationMutation = { unsuspendOrganization: { organization: { id: string, status: OrganizationStatus, suspendedAt: string | null } | null, userErrors: Array<{ code: string, message: string, field: Array<string> | null }> } };

export type ChangeOrganizationPlanMutationVariables = Exact<{
  input: ChangeOrganizationPlanInput;
}>;


export type ChangeOrganizationPlanMutation = { changeOrganizationPlan: { organization: { id: string, plan: PlanCode } | null, userErrors: Array<{ code: string, message: string, field: Array<string> | null }> } };

export type RevokeUserSessionsMutationVariables = Exact<{
  input: RevokeUserSessionsInput;
}>;


export type RevokeUserSessionsMutation = { revokeUserSessions: { revoked: number, userErrors: Array<{ code: string, message: string, field: Array<string> | null }> } };

export type AuditLogQueryVariables = Exact<{
  filter?: AuditLogFilter | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type AuditLogQuery = { auditLog: { edges: Array<{ node: { id: string, at: string, action: string, organizationId: string | null, organizationName: string | null, targetUserId: string | null, reason: string | null, staff: { id: string, email: string } | null } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}

export const MeDocument = new TypedDocumentString(`
    query Me {
  me {
    id
    email
    name
    role
  }
}
    `) as unknown as TypedDocumentString<MeQuery, MeQueryVariables>;
export const SignInDocument = new TypedDocumentString(`
    mutation SignIn($input: StaffSignInInput!) {
  signIn(input: $input) {
    next
    enrolment {
      secret
      otpauthUri
    }
    userErrors {
      code
      message
      field
    }
  }
}
    `) as unknown as TypedDocumentString<SignInMutation, SignInMutationVariables>;
export const VerifyMfaDocument = new TypedDocumentString(`
    mutation VerifyMfa($input: VerifyMfaInput!) {
  verifyMfa(input: $input) {
    staff {
      id
      email
      name
      role
    }
    recoveryCodes
    userErrors {
      code
      message
      field
    }
  }
}
    `) as unknown as TypedDocumentString<VerifyMfaMutation, VerifyMfaMutationVariables>;
export const SignOutDocument = new TypedDocumentString(`
    mutation SignOut {
  signOut
}
    `) as unknown as TypedDocumentString<SignOutMutation, SignOutMutationVariables>;
export const OrganizationsDocument = new TypedDocumentString(`
    query Organizations($search: String, $status: OrganizationStatus, $first: Int, $after: String) {
  organizations(search: $search, status: $status, first: $first, after: $after) {
    edges {
      node {
        id
        name
        slug
        plan
        status
        createdAt
        memberCount
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
    `) as unknown as TypedDocumentString<OrganizationsQuery, OrganizationsQueryVariables>;
export const OrganizationDocument = new TypedDocumentString(`
    query Organization($id: ID!) {
  organization(id: $id) {
    id
    name
    slug
    plan
    status
    createdAt
    suspendedAt
    memberCount
    usage {
      customers
      invoicesThisMonth
      seats
      customersLimit
      invoicesPerMonthLimit
      seatsLimit
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
      name
      email
      role
      activeSessions
    }
  }
}
    `) as unknown as TypedDocumentString<OrganizationQuery, OrganizationQueryVariables>;
export const SuspendOrganizationDocument = new TypedDocumentString(`
    mutation SuspendOrganization($input: OrganizationActionInput!) {
  suspendOrganization(input: $input) {
    organization {
      id
      status
      suspendedAt
    }
    userErrors {
      code
      message
      field
    }
  }
}
    `) as unknown as TypedDocumentString<SuspendOrganizationMutation, SuspendOrganizationMutationVariables>;
export const UnsuspendOrganizationDocument = new TypedDocumentString(`
    mutation UnsuspendOrganization($input: OrganizationActionInput!) {
  unsuspendOrganization(input: $input) {
    organization {
      id
      status
      suspendedAt
    }
    userErrors {
      code
      message
      field
    }
  }
}
    `) as unknown as TypedDocumentString<UnsuspendOrganizationMutation, UnsuspendOrganizationMutationVariables>;
export const ChangeOrganizationPlanDocument = new TypedDocumentString(`
    mutation ChangeOrganizationPlan($input: ChangeOrganizationPlanInput!) {
  changeOrganizationPlan(input: $input) {
    organization {
      id
      plan
    }
    userErrors {
      code
      message
      field
    }
  }
}
    `) as unknown as TypedDocumentString<ChangeOrganizationPlanMutation, ChangeOrganizationPlanMutationVariables>;
export const RevokeUserSessionsDocument = new TypedDocumentString(`
    mutation RevokeUserSessions($input: RevokeUserSessionsInput!) {
  revokeUserSessions(input: $input) {
    revoked
    userErrors {
      code
      message
      field
    }
  }
}
    `) as unknown as TypedDocumentString<RevokeUserSessionsMutation, RevokeUserSessionsMutationVariables>;
export const AuditLogDocument = new TypedDocumentString(`
    query AuditLog($filter: AuditLogFilter, $first: Int, $after: String) {
  auditLog(filter: $filter, first: $first, after: $after) {
    edges {
      node {
        id
        at
        action
        organizationId
        organizationName
        targetUserId
        reason
        staff {
          id
          email
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
    `) as unknown as TypedDocumentString<AuditLogQuery, AuditLogQueryVariables>;