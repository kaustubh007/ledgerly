import { graphql } from './__generated__';

export const MeQuery = graphql(`
  query Me {
    me {
      id
      email
      name
      role
    }
  }
`);

export const SignInMutation = graphql(`
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
`);

export const VerifyMfaMutation = graphql(`
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
`);

export const SignOutMutation = graphql(`
  mutation SignOut {
    signOut
  }
`);

export const OrganizationsQuery = graphql(`
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
`);

export const OrganizationQuery = graphql(`
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
`);

export const SuspendOrganizationMutation = graphql(`
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
`);

export const UnsuspendOrganizationMutation = graphql(`
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
`);

export const ChangeOrganizationPlanMutation = graphql(`
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
`);

export const RevokeUserSessionsMutation = graphql(`
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
`);

export const AuditLogQuery = graphql(`
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
`);
