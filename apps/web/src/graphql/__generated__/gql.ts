/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

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
    "\n  query Viewer {\n    viewer {\n      id\n      name\n      email\n      memberships {\n        role\n        organization {\n          id\n          slug\n          name\n        }\n      }\n    }\n  }\n": typeof types.ViewerDocument,
    "\n  query OrgShell {\n    viewer {\n      id\n      name\n      email\n      memberships {\n        role\n        organization {\n          id\n          slug\n          name\n        }\n      }\n    }\n    organization {\n      id\n      slug\n      name\n      viewerRole\n    }\n  }\n": typeof types.OrgShellDocument,
    "\n  query Dashboard {\n    dashboard {\n      totals {\n        currency\n        outstanding {\n          amount\n        }\n        overdue {\n          amount\n        }\n      }\n      countsByStatus {\n        status\n        count\n      }\n    }\n  }\n": typeof types.DashboardDocument,
    "\n  query Customers($first: Int, $after: String) {\n    customers(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          email\n          defaultCurrency\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.CustomersDocument,
    "\n  mutation LogIn($input: LogInInput!) {\n    logIn(input: $input) {\n      viewer {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.LogInDocument,
    "\n  mutation SignUp($input: SignUpInput!) {\n    signUp(input: $input) {\n      viewer {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.SignUpDocument,
    "\n  fragment CustomerFields on Customer {\n    id\n    name\n    email\n    defaultCurrency\n    documentLocale\n    billingAddress\n  }\n": typeof types.CustomerFieldsFragmentDoc,
    "\n  query Customer($id: ID!) {\n    customer(id: $id) {\n      ...CustomerFields\n    }\n  }\n": typeof types.CustomerDocument,
    "\n  query CustomerOptions {\n    customers(first: 100) {\n      edges {\n        node {\n          id\n          name\n          defaultCurrency\n        }\n      }\n    }\n  }\n": typeof types.CustomerOptionsDocument,
    "\n  mutation CreateCustomer($input: CustomerInput!) {\n    createCustomer(input: $input) {\n      customer {\n        ...CustomerFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.CreateCustomerDocument,
    "\n  mutation UpdateCustomer($id: ID!, $input: CustomerInput!) {\n    updateCustomer(id: $id, input: $input) {\n      customer {\n        ...CustomerFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.UpdateCustomerDocument,
    "\n  fragment InvoiceDetailFields on Invoice {\n    id\n    number\n    status\n    currency\n    dueDate\n    overdue\n    sentAt\n    createdAt\n    customer {\n      id\n      name\n    }\n    lines {\n      description\n      quantity\n      unitPrice {\n        amount\n      }\n      total {\n        amount\n      }\n    }\n    total {\n      amount\n    }\n    paid {\n      amount\n    }\n    balance {\n      amount\n    }\n    payments {\n      id\n      method\n      reference\n      recordedAt\n      amount {\n        amount\n      }\n    }\n  }\n": typeof types.InvoiceDetailFieldsFragmentDoc,
    "\n  query Invoices($first: Int, $after: String, $status: InvoiceStatus, $customerId: ID) {\n    invoices(first: $first, after: $after, status: $status, customerId: $customerId) {\n      edges {\n        node {\n          id\n          number\n          status\n          currency\n          dueDate\n          overdue\n          customer {\n            id\n            name\n          }\n          total {\n            amount\n          }\n          balance {\n            amount\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.InvoicesDocument,
    "\n  query Invoice($id: ID!) {\n    invoice(id: $id) {\n      ...InvoiceDetailFields\n    }\n  }\n": typeof types.InvoiceDocument,
    "\n  mutation CreateInvoice($input: CreateInvoiceInput!, $key: ID!) {\n    createInvoice(input: $input, idempotencyKey: $key) {\n      invoice {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.CreateInvoiceDocument,
    "\n  mutation SendInvoice($id: ID!, $key: ID!) {\n    sendInvoice(id: $id, idempotencyKey: $key) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.SendInvoiceDocument,
    "\n  mutation RecordPayment($input: RecordPaymentInput!, $key: ID!) {\n    recordPayment(input: $input, idempotencyKey: $key) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.RecordPaymentDocument,
    "\n  mutation PayInvoiceByCard($input: CardPaymentInput!, $key: ID!) {\n    payInvoiceByCard(input: $input, idempotencyKey: $key) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.PayInvoiceByCardDocument,
    "\n  mutation VoidInvoice($id: ID!) {\n    voidInvoice(id: $id) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.VoidInvoiceDocument,
    "\n  query Billing {\n    organization {\n      id\n      viewerRole\n      plan {\n        code\n      }\n      usage {\n        customers\n        invoicesThisMonth\n        seats\n      }\n    }\n    plans {\n      code\n      monthlyPrice {\n        amount\n        currency\n      }\n      limits {\n        customers\n        invoicesPerMonth\n        seats\n      }\n      features {\n        customBranding\n        mfaEnforcement\n        auditExport\n      }\n    }\n  }\n": typeof types.BillingDocument,
    "\n  mutation ChangePlan($input: ChangePlanInput!, $key: ID!) {\n    changePlan(input: $input, idempotencyKey: $key) {\n      organization {\n        id\n        plan {\n          code\n        }\n        usage {\n          customers\n          invoicesThisMonth\n          seats\n        }\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": typeof types.ChangePlanDocument,
};
const documents: Documents = {
    "\n  query Viewer {\n    viewer {\n      id\n      name\n      email\n      memberships {\n        role\n        organization {\n          id\n          slug\n          name\n        }\n      }\n    }\n  }\n": types.ViewerDocument,
    "\n  query OrgShell {\n    viewer {\n      id\n      name\n      email\n      memberships {\n        role\n        organization {\n          id\n          slug\n          name\n        }\n      }\n    }\n    organization {\n      id\n      slug\n      name\n      viewerRole\n    }\n  }\n": types.OrgShellDocument,
    "\n  query Dashboard {\n    dashboard {\n      totals {\n        currency\n        outstanding {\n          amount\n        }\n        overdue {\n          amount\n        }\n      }\n      countsByStatus {\n        status\n        count\n      }\n    }\n  }\n": types.DashboardDocument,
    "\n  query Customers($first: Int, $after: String) {\n    customers(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          email\n          defaultCurrency\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.CustomersDocument,
    "\n  mutation LogIn($input: LogInInput!) {\n    logIn(input: $input) {\n      viewer {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.LogInDocument,
    "\n  mutation SignUp($input: SignUpInput!) {\n    signUp(input: $input) {\n      viewer {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.SignUpDocument,
    "\n  fragment CustomerFields on Customer {\n    id\n    name\n    email\n    defaultCurrency\n    documentLocale\n    billingAddress\n  }\n": types.CustomerFieldsFragmentDoc,
    "\n  query Customer($id: ID!) {\n    customer(id: $id) {\n      ...CustomerFields\n    }\n  }\n": types.CustomerDocument,
    "\n  query CustomerOptions {\n    customers(first: 100) {\n      edges {\n        node {\n          id\n          name\n          defaultCurrency\n        }\n      }\n    }\n  }\n": types.CustomerOptionsDocument,
    "\n  mutation CreateCustomer($input: CustomerInput!) {\n    createCustomer(input: $input) {\n      customer {\n        ...CustomerFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.CreateCustomerDocument,
    "\n  mutation UpdateCustomer($id: ID!, $input: CustomerInput!) {\n    updateCustomer(id: $id, input: $input) {\n      customer {\n        ...CustomerFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.UpdateCustomerDocument,
    "\n  fragment InvoiceDetailFields on Invoice {\n    id\n    number\n    status\n    currency\n    dueDate\n    overdue\n    sentAt\n    createdAt\n    customer {\n      id\n      name\n    }\n    lines {\n      description\n      quantity\n      unitPrice {\n        amount\n      }\n      total {\n        amount\n      }\n    }\n    total {\n      amount\n    }\n    paid {\n      amount\n    }\n    balance {\n      amount\n    }\n    payments {\n      id\n      method\n      reference\n      recordedAt\n      amount {\n        amount\n      }\n    }\n  }\n": types.InvoiceDetailFieldsFragmentDoc,
    "\n  query Invoices($first: Int, $after: String, $status: InvoiceStatus, $customerId: ID) {\n    invoices(first: $first, after: $after, status: $status, customerId: $customerId) {\n      edges {\n        node {\n          id\n          number\n          status\n          currency\n          dueDate\n          overdue\n          customer {\n            id\n            name\n          }\n          total {\n            amount\n          }\n          balance {\n            amount\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.InvoicesDocument,
    "\n  query Invoice($id: ID!) {\n    invoice(id: $id) {\n      ...InvoiceDetailFields\n    }\n  }\n": types.InvoiceDocument,
    "\n  mutation CreateInvoice($input: CreateInvoiceInput!, $key: ID!) {\n    createInvoice(input: $input, idempotencyKey: $key) {\n      invoice {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.CreateInvoiceDocument,
    "\n  mutation SendInvoice($id: ID!, $key: ID!) {\n    sendInvoice(id: $id, idempotencyKey: $key) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.SendInvoiceDocument,
    "\n  mutation RecordPayment($input: RecordPaymentInput!, $key: ID!) {\n    recordPayment(input: $input, idempotencyKey: $key) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.RecordPaymentDocument,
    "\n  mutation PayInvoiceByCard($input: CardPaymentInput!, $key: ID!) {\n    payInvoiceByCard(input: $input, idempotencyKey: $key) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.PayInvoiceByCardDocument,
    "\n  mutation VoidInvoice($id: ID!) {\n    voidInvoice(id: $id) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.VoidInvoiceDocument,
    "\n  query Billing {\n    organization {\n      id\n      viewerRole\n      plan {\n        code\n      }\n      usage {\n        customers\n        invoicesThisMonth\n        seats\n      }\n    }\n    plans {\n      code\n      monthlyPrice {\n        amount\n        currency\n      }\n      limits {\n        customers\n        invoicesPerMonth\n        seats\n      }\n      features {\n        customBranding\n        mfaEnforcement\n        auditExport\n      }\n    }\n  }\n": types.BillingDocument,
    "\n  mutation ChangePlan($input: ChangePlanInput!, $key: ID!) {\n    changePlan(input: $input, idempotencyKey: $key) {\n      organization {\n        id\n        plan {\n          code\n        }\n        usage {\n          customers\n          invoicesThisMonth\n          seats\n        }\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.ChangePlanDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Viewer {\n    viewer {\n      id\n      name\n      email\n      memberships {\n        role\n        organization {\n          id\n          slug\n          name\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query Viewer {\n    viewer {\n      id\n      name\n      email\n      memberships {\n        role\n        organization {\n          id\n          slug\n          name\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query OrgShell {\n    viewer {\n      id\n      name\n      email\n      memberships {\n        role\n        organization {\n          id\n          slug\n          name\n        }\n      }\n    }\n    organization {\n      id\n      slug\n      name\n      viewerRole\n    }\n  }\n"): (typeof documents)["\n  query OrgShell {\n    viewer {\n      id\n      name\n      email\n      memberships {\n        role\n        organization {\n          id\n          slug\n          name\n        }\n      }\n    }\n    organization {\n      id\n      slug\n      name\n      viewerRole\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Dashboard {\n    dashboard {\n      totals {\n        currency\n        outstanding {\n          amount\n        }\n        overdue {\n          amount\n        }\n      }\n      countsByStatus {\n        status\n        count\n      }\n    }\n  }\n"): (typeof documents)["\n  query Dashboard {\n    dashboard {\n      totals {\n        currency\n        outstanding {\n          amount\n        }\n        overdue {\n          amount\n        }\n      }\n      countsByStatus {\n        status\n        count\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Customers($first: Int, $after: String) {\n    customers(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          email\n          defaultCurrency\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): (typeof documents)["\n  query Customers($first: Int, $after: String) {\n    customers(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          email\n          defaultCurrency\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation LogIn($input: LogInInput!) {\n    logIn(input: $input) {\n      viewer {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation LogIn($input: LogInInput!) {\n    logIn(input: $input) {\n      viewer {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SignUp($input: SignUpInput!) {\n    signUp(input: $input) {\n      viewer {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation SignUp($input: SignUpInput!) {\n    signUp(input: $input) {\n      viewer {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment CustomerFields on Customer {\n    id\n    name\n    email\n    defaultCurrency\n    documentLocale\n    billingAddress\n  }\n"): (typeof documents)["\n  fragment CustomerFields on Customer {\n    id\n    name\n    email\n    defaultCurrency\n    documentLocale\n    billingAddress\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Customer($id: ID!) {\n    customer(id: $id) {\n      ...CustomerFields\n    }\n  }\n"): (typeof documents)["\n  query Customer($id: ID!) {\n    customer(id: $id) {\n      ...CustomerFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CustomerOptions {\n    customers(first: 100) {\n      edges {\n        node {\n          id\n          name\n          defaultCurrency\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query CustomerOptions {\n    customers(first: 100) {\n      edges {\n        node {\n          id\n          name\n          defaultCurrency\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateCustomer($input: CustomerInput!) {\n    createCustomer(input: $input) {\n      customer {\n        ...CustomerFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation CreateCustomer($input: CustomerInput!) {\n    createCustomer(input: $input) {\n      customer {\n        ...CustomerFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateCustomer($id: ID!, $input: CustomerInput!) {\n    updateCustomer(id: $id, input: $input) {\n      customer {\n        ...CustomerFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateCustomer($id: ID!, $input: CustomerInput!) {\n    updateCustomer(id: $id, input: $input) {\n      customer {\n        ...CustomerFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment InvoiceDetailFields on Invoice {\n    id\n    number\n    status\n    currency\n    dueDate\n    overdue\n    sentAt\n    createdAt\n    customer {\n      id\n      name\n    }\n    lines {\n      description\n      quantity\n      unitPrice {\n        amount\n      }\n      total {\n        amount\n      }\n    }\n    total {\n      amount\n    }\n    paid {\n      amount\n    }\n    balance {\n      amount\n    }\n    payments {\n      id\n      method\n      reference\n      recordedAt\n      amount {\n        amount\n      }\n    }\n  }\n"): (typeof documents)["\n  fragment InvoiceDetailFields on Invoice {\n    id\n    number\n    status\n    currency\n    dueDate\n    overdue\n    sentAt\n    createdAt\n    customer {\n      id\n      name\n    }\n    lines {\n      description\n      quantity\n      unitPrice {\n        amount\n      }\n      total {\n        amount\n      }\n    }\n    total {\n      amount\n    }\n    paid {\n      amount\n    }\n    balance {\n      amount\n    }\n    payments {\n      id\n      method\n      reference\n      recordedAt\n      amount {\n        amount\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Invoices($first: Int, $after: String, $status: InvoiceStatus, $customerId: ID) {\n    invoices(first: $first, after: $after, status: $status, customerId: $customerId) {\n      edges {\n        node {\n          id\n          number\n          status\n          currency\n          dueDate\n          overdue\n          customer {\n            id\n            name\n          }\n          total {\n            amount\n          }\n          balance {\n            amount\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): (typeof documents)["\n  query Invoices($first: Int, $after: String, $status: InvoiceStatus, $customerId: ID) {\n    invoices(first: $first, after: $after, status: $status, customerId: $customerId) {\n      edges {\n        node {\n          id\n          number\n          status\n          currency\n          dueDate\n          overdue\n          customer {\n            id\n            name\n          }\n          total {\n            amount\n          }\n          balance {\n            amount\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Invoice($id: ID!) {\n    invoice(id: $id) {\n      ...InvoiceDetailFields\n    }\n  }\n"): (typeof documents)["\n  query Invoice($id: ID!) {\n    invoice(id: $id) {\n      ...InvoiceDetailFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateInvoice($input: CreateInvoiceInput!, $key: ID!) {\n    createInvoice(input: $input, idempotencyKey: $key) {\n      invoice {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation CreateInvoice($input: CreateInvoiceInput!, $key: ID!) {\n    createInvoice(input: $input, idempotencyKey: $key) {\n      invoice {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SendInvoice($id: ID!, $key: ID!) {\n    sendInvoice(id: $id, idempotencyKey: $key) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation SendInvoice($id: ID!, $key: ID!) {\n    sendInvoice(id: $id, idempotencyKey: $key) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RecordPayment($input: RecordPaymentInput!, $key: ID!) {\n    recordPayment(input: $input, idempotencyKey: $key) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation RecordPayment($input: RecordPaymentInput!, $key: ID!) {\n    recordPayment(input: $input, idempotencyKey: $key) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation PayInvoiceByCard($input: CardPaymentInput!, $key: ID!) {\n    payInvoiceByCard(input: $input, idempotencyKey: $key) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation PayInvoiceByCard($input: CardPaymentInput!, $key: ID!) {\n    payInvoiceByCard(input: $input, idempotencyKey: $key) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation VoidInvoice($id: ID!) {\n    voidInvoice(id: $id) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation VoidInvoice($id: ID!) {\n    voidInvoice(id: $id) {\n      invoice {\n        ...InvoiceDetailFields\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Billing {\n    organization {\n      id\n      viewerRole\n      plan {\n        code\n      }\n      usage {\n        customers\n        invoicesThisMonth\n        seats\n      }\n    }\n    plans {\n      code\n      monthlyPrice {\n        amount\n        currency\n      }\n      limits {\n        customers\n        invoicesPerMonth\n        seats\n      }\n      features {\n        customBranding\n        mfaEnforcement\n        auditExport\n      }\n    }\n  }\n"): (typeof documents)["\n  query Billing {\n    organization {\n      id\n      viewerRole\n      plan {\n        code\n      }\n      usage {\n        customers\n        invoicesThisMonth\n        seats\n      }\n    }\n    plans {\n      code\n      monthlyPrice {\n        amount\n        currency\n      }\n      limits {\n        customers\n        invoicesPerMonth\n        seats\n      }\n      features {\n        customBranding\n        mfaEnforcement\n        auditExport\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ChangePlan($input: ChangePlanInput!, $key: ID!) {\n    changePlan(input: $input, idempotencyKey: $key) {\n      organization {\n        id\n        plan {\n          code\n        }\n        usage {\n          customers\n          invoicesThisMonth\n          seats\n        }\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation ChangePlan($input: ChangePlanInput!, $key: ID!) {\n    changePlan(input: $input, idempotencyKey: $key) {\n      organization {\n        id\n        plan {\n          code\n        }\n        usage {\n          customers\n          invoicesThisMonth\n          seats\n        }\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;