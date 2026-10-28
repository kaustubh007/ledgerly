import { graphql } from './__generated__';

// Every operation the web app sends, in one place, so codegen sees them all and a reviewer can
// read the app's whole API surface in one file.

export const ViewerQuery = graphql(`
  query Viewer {
    viewer {
      id
      name
      email
      memberships {
        role
        organization {
          id
          slug
          name
        }
      }
    }
  }
`);

export const OrgShellQuery = graphql(`
  query OrgShell {
    viewer {
      id
      name
      email
      memberships {
        role
        organization {
          id
          slug
          name
        }
      }
    }
    organization {
      id
      slug
      name
      viewerRole
    }
  }
`);

export const DashboardQuery = graphql(`
  query Dashboard {
    dashboard {
      totals {
        currency
        outstanding {
          amount
        }
        overdue {
          amount
        }
      }
      countsByStatus {
        status
        count
      }
    }
  }
`);

export const CustomersQuery = graphql(`
  query Customers($first: Int, $after: String) {
    customers(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          name
          email
          defaultCurrency
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

export const LogInMutation = graphql(`
  mutation LogIn($input: LogInInput!) {
    logIn(input: $input) {
      viewer {
        id
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`);

export const SignUpMutation = graphql(`
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      viewer {
        id
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`);
