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

// ── Customers ─────────────────────────────────────────────────────────────────────────────

export const CustomerFields = graphql(`
  fragment CustomerFields on Customer {
    id
    name
    email
    defaultCurrency
    documentLocale
    billingAddress
  }
`);

export const CustomerQuery = graphql(`
  query Customer($id: ID!) {
    customer(id: $id) {
      ...CustomerFields
    }
  }
`);

export const CustomerOptionsQuery = graphql(`
  query CustomerOptions {
    customers(first: 100) {
      edges {
        node {
          id
          name
          defaultCurrency
        }
      }
    }
  }
`);

export const CreateCustomerMutation = graphql(`
  mutation CreateCustomer($input: CustomerInput!) {
    createCustomer(input: $input) {
      customer {
        ...CustomerFields
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`);

export const UpdateCustomerMutation = graphql(`
  mutation UpdateCustomer($id: ID!, $input: CustomerInput!) {
    updateCustomer(id: $id, input: $input) {
      customer {
        ...CustomerFields
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`);

// ── Invoices ──────────────────────────────────────────────────────────────────────────────

/** Everything the invoice page shows. Every invoice mutation returns it, so Apollo's normalised
 * cache updates the page in place: no refetch after send, pay or void. */
export const InvoiceDetailFields = graphql(`
  fragment InvoiceDetailFields on Invoice {
    id
    number
    status
    currency
    dueDate
    overdue
    sentAt
    createdAt
    customer {
      id
      name
    }
    lines {
      description
      quantity
      unitPrice {
        amount
      }
      total {
        amount
      }
    }
    total {
      amount
    }
    paid {
      amount
    }
    balance {
      amount
    }
    payments {
      id
      method
      reference
      recordedAt
      amount {
        amount
      }
    }
  }
`);

export const InvoicesQuery = graphql(`
  query Invoices($first: Int, $after: String, $status: InvoiceStatus, $customerId: ID) {
    invoices(first: $first, after: $after, status: $status, customerId: $customerId) {
      edges {
        node {
          id
          number
          status
          currency
          dueDate
          overdue
          customer {
            id
            name
          }
          total {
            amount
          }
          balance {
            amount
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

export const InvoiceQuery = graphql(`
  query Invoice($id: ID!) {
    invoice(id: $id) {
      ...InvoiceDetailFields
    }
  }
`);

export const CreateInvoiceMutation = graphql(`
  mutation CreateInvoice($input: CreateInvoiceInput!, $key: ID!) {
    createInvoice(input: $input, idempotencyKey: $key) {
      invoice {
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

export const SendInvoiceMutation = graphql(`
  mutation SendInvoice($id: ID!, $key: ID!) {
    sendInvoice(id: $id, idempotencyKey: $key) {
      invoice {
        ...InvoiceDetailFields
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`);

export const RecordPaymentMutation = graphql(`
  mutation RecordPayment($input: RecordPaymentInput!, $key: ID!) {
    recordPayment(input: $input, idempotencyKey: $key) {
      invoice {
        ...InvoiceDetailFields
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`);

export const PayInvoiceByCardMutation = graphql(`
  mutation PayInvoiceByCard($input: CardPaymentInput!, $key: ID!) {
    payInvoiceByCard(input: $input, idempotencyKey: $key) {
      invoice {
        ...InvoiceDetailFields
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`);

export const VoidInvoiceMutation = graphql(`
  mutation VoidInvoice($id: ID!) {
    voidInvoice(id: $id) {
      invoice {
        ...InvoiceDetailFields
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`);

// ── Billing ───────────────────────────────────────────────────────────────────────────────

export const BillingQuery = graphql(`
  query Billing {
    organization {
      id
      viewerRole
      plan {
        code
      }
      usage {
        customers
        invoicesThisMonth
        seats
      }
    }
    plans {
      code
      monthlyPrice {
        amount
        currency
      }
      limits {
        customers
        invoicesPerMonth
        seats
      }
      features {
        customBranding
        mfaEnforcement
        auditExport
      }
    }
  }
`);

export const ChangePlanMutation = graphql(`
  mutation ChangePlan($input: ChangePlanInput!, $key: ID!) {
    changePlan(input: $input, idempotencyKey: $key) {
      organization {
        id
        plan {
          code
        }
        usage {
          customers
          invoicesThisMonth
          seats
        }
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`);
