/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query Me {\n    me {\n      id\n      email\n      name\n      role\n    }\n  }\n": typeof types.MeDocument,
    "\n  mutation SignIn($input: StaffSignInInput!) {\n    signIn(input: $input) {\n      next\n      enrolment {\n        secret\n        otpauthUri\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.SignInDocument,
    "\n  mutation VerifyMfa($input: VerifyMfaInput!) {\n    verifyMfa(input: $input) {\n      staff {\n        id\n        email\n        name\n        role\n      }\n      recoveryCodes\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.VerifyMfaDocument,
    "\n  mutation SignOut {\n    signOut\n  }\n": typeof types.SignOutDocument,
    "\n  query Organizations($search: String, $status: OrganizationStatus, $first: Int, $after: String) {\n    organizations(search: $search, status: $status, first: $first, after: $after) {\n      edges {\n        node {\n          id\n          name\n          slug\n          plan\n          status\n          createdAt\n          memberCount\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.OrganizationsDocument,
    "\n  query Organization($id: ID!) {\n    organization(id: $id) {\n      id\n      name\n      slug\n      plan\n      status\n      createdAt\n      suspendedAt\n      memberCount\n      usage {\n        customers\n        invoicesThisMonth\n        seats\n        customersLimit\n        invoicesPerMonthLimit\n        seatsLimit\n      }\n      outstanding {\n        currency\n        amount {\n          amount\n          currency\n        }\n        invoices\n      }\n      health {\n        lastActiveAt\n        overdueInvoices\n      }\n      members {\n        userId\n        name\n        email\n        role\n        activeSessions\n      }\n    }\n  }\n": typeof types.OrganizationDocument,
    "\n  mutation SuspendOrganization($input: OrganizationActionInput!) {\n    suspendOrganization(input: $input) {\n      organization {\n        id\n        status\n        suspendedAt\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.SuspendOrganizationDocument,
    "\n  mutation UnsuspendOrganization($input: OrganizationActionInput!) {\n    unsuspendOrganization(input: $input) {\n      organization {\n        id\n        status\n        suspendedAt\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.UnsuspendOrganizationDocument,
    "\n  mutation ChangeOrganizationPlan($input: ChangeOrganizationPlanInput!) {\n    changeOrganizationPlan(input: $input) {\n      organization {\n        id\n        plan\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.ChangeOrganizationPlanDocument,
    "\n  mutation RevokeUserSessions($input: RevokeUserSessionsInput!) {\n    revokeUserSessions(input: $input) {\n      revoked\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.RevokeUserSessionsDocument,
    "\n  query AuditLog($filter: AuditLogFilter, $first: Int, $after: String) {\n    auditLog(filter: $filter, first: $first, after: $after) {\n      edges {\n        node {\n          id\n          at\n          action\n          organizationId\n          organizationName\n          targetUserId\n          reason\n          staff {\n            id\n            email\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.AuditLogDocument,
};
const documents: Documents = {
    "\n  query Me {\n    me {\n      id\n      email\n      name\n      role\n    }\n  }\n": types.MeDocument,
    "\n  mutation SignIn($input: StaffSignInInput!) {\n    signIn(input: $input) {\n      next\n      enrolment {\n        secret\n        otpauthUri\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.SignInDocument,
    "\n  mutation VerifyMfa($input: VerifyMfaInput!) {\n    verifyMfa(input: $input) {\n      staff {\n        id\n        email\n        name\n        role\n      }\n      recoveryCodes\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.VerifyMfaDocument,
    "\n  mutation SignOut {\n    signOut\n  }\n": types.SignOutDocument,
    "\n  query Organizations($search: String, $status: OrganizationStatus, $first: Int, $after: String) {\n    organizations(search: $search, status: $status, first: $first, after: $after) {\n      edges {\n        node {\n          id\n          name\n          slug\n          plan\n          status\n          createdAt\n          memberCount\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.OrganizationsDocument,
    "\n  query Organization($id: ID!) {\n    organization(id: $id) {\n      id\n      name\n      slug\n      plan\n      status\n      createdAt\n      suspendedAt\n      memberCount\n      usage {\n        customers\n        invoicesThisMonth\n        seats\n        customersLimit\n        invoicesPerMonthLimit\n        seatsLimit\n      }\n      outstanding {\n        currency\n        amount {\n          amount\n          currency\n        }\n        invoices\n      }\n      health {\n        lastActiveAt\n        overdueInvoices\n      }\n      members {\n        userId\n        name\n        email\n        role\n        activeSessions\n      }\n    }\n  }\n": types.OrganizationDocument,
    "\n  mutation SuspendOrganization($input: OrganizationActionInput!) {\n    suspendOrganization(input: $input) {\n      organization {\n        id\n        status\n        suspendedAt\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.SuspendOrganizationDocument,
    "\n  mutation UnsuspendOrganization($input: OrganizationActionInput!) {\n    unsuspendOrganization(input: $input) {\n      organization {\n        id\n        status\n        suspendedAt\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.UnsuspendOrganizationDocument,
    "\n  mutation ChangeOrganizationPlan($input: ChangeOrganizationPlanInput!) {\n    changeOrganizationPlan(input: $input) {\n      organization {\n        id\n        plan\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.ChangeOrganizationPlanDocument,
    "\n  mutation RevokeUserSessions($input: RevokeUserSessionsInput!) {\n    revokeUserSessions(input: $input) {\n      revoked\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.RevokeUserSessionsDocument,
    "\n  query AuditLog($filter: AuditLogFilter, $first: Int, $after: String) {\n    auditLog(filter: $filter, first: $first, after: $after) {\n      edges {\n        node {\n          id\n          at\n          action\n          organizationId\n          organizationName\n          targetUserId\n          reason\n          staff {\n            id\n            email\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.AuditLogDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Me {\n    me {\n      id\n      email\n      name\n      role\n    }\n  }\n"): typeof import('./graphql').MeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SignIn($input: StaffSignInInput!) {\n    signIn(input: $input) {\n      next\n      enrolment {\n        secret\n        otpauthUri\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): typeof import('./graphql').SignInDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation VerifyMfa($input: VerifyMfaInput!) {\n    verifyMfa(input: $input) {\n      staff {\n        id\n        email\n        name\n        role\n      }\n      recoveryCodes\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): typeof import('./graphql').VerifyMfaDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SignOut {\n    signOut\n  }\n"): typeof import('./graphql').SignOutDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Organizations($search: String, $status: OrganizationStatus, $first: Int, $after: String) {\n    organizations(search: $search, status: $status, first: $first, after: $after) {\n      edges {\n        node {\n          id\n          name\n          slug\n          plan\n          status\n          createdAt\n          memberCount\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): typeof import('./graphql').OrganizationsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Organization($id: ID!) {\n    organization(id: $id) {\n      id\n      name\n      slug\n      plan\n      status\n      createdAt\n      suspendedAt\n      memberCount\n      usage {\n        customers\n        invoicesThisMonth\n        seats\n        customersLimit\n        invoicesPerMonthLimit\n        seatsLimit\n      }\n      outstanding {\n        currency\n        amount {\n          amount\n          currency\n        }\n        invoices\n      }\n      health {\n        lastActiveAt\n        overdueInvoices\n      }\n      members {\n        userId\n        name\n        email\n        role\n        activeSessions\n      }\n    }\n  }\n"): typeof import('./graphql').OrganizationDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SuspendOrganization($input: OrganizationActionInput!) {\n    suspendOrganization(input: $input) {\n      organization {\n        id\n        status\n        suspendedAt\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): typeof import('./graphql').SuspendOrganizationDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UnsuspendOrganization($input: OrganizationActionInput!) {\n    unsuspendOrganization(input: $input) {\n      organization {\n        id\n        status\n        suspendedAt\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): typeof import('./graphql').UnsuspendOrganizationDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ChangeOrganizationPlan($input: ChangeOrganizationPlanInput!) {\n    changeOrganizationPlan(input: $input) {\n      organization {\n        id\n        plan\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): typeof import('./graphql').ChangeOrganizationPlanDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RevokeUserSessions($input: RevokeUserSessionsInput!) {\n    revokeUserSessions(input: $input) {\n      revoked\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): typeof import('./graphql').RevokeUserSessionsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AuditLog($filter: AuditLogFilter, $first: Int, $after: String) {\n    auditLog(filter: $filter, first: $first, after: $after) {\n      edges {\n        node {\n          id\n          at\n          action\n          organizationId\n          organizationName\n          targetUserId\n          reason\n          staff {\n            id\n            email\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): typeof import('./graphql').AuditLogDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
