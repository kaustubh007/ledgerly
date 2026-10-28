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
};
const documents: Documents = {
    "\n  query Viewer {\n    viewer {\n      id\n      name\n      email\n      memberships {\n        role\n        organization {\n          id\n          slug\n          name\n        }\n      }\n    }\n  }\n": types.ViewerDocument,
    "\n  query OrgShell {\n    viewer {\n      id\n      name\n      email\n      memberships {\n        role\n        organization {\n          id\n          slug\n          name\n        }\n      }\n    }\n    organization {\n      id\n      slug\n      name\n      viewerRole\n    }\n  }\n": types.OrgShellDocument,
    "\n  query Dashboard {\n    dashboard {\n      totals {\n        currency\n        outstanding {\n          amount\n        }\n        overdue {\n          amount\n        }\n      }\n      countsByStatus {\n        status\n        count\n      }\n    }\n  }\n": types.DashboardDocument,
    "\n  query Customers($first: Int, $after: String) {\n    customers(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          email\n          defaultCurrency\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.CustomersDocument,
    "\n  mutation LogIn($input: LogInInput!) {\n    logIn(input: $input) {\n      viewer {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.LogInDocument,
    "\n  mutation SignUp($input: SignUpInput!) {\n    signUp(input: $input) {\n      viewer {\n        id\n      }\n      userErrors {\n        code\n        message\n        field\n      }\n    }\n  }\n": types.SignUpDocument,
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

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;