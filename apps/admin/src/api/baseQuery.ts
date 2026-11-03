import type { BaseQueryFn } from '@reduxjs/toolkit/query/react';

/**
 * What every RTK Query endpoint sends: a document and its variables. Documents are codegen's
 * `TypedDocumentString`s (typed for the endpoint's result and variables); here only the text
 * matters.
 */
export interface GraphQLRequest {
  readonly document: { toString(): string };
  readonly variables?: Readonly<Record<string, unknown>>;
}

/** A failed request, as a stable code the UI translates (never server English). */
export interface AdminApiError {
  readonly code: string;
  readonly message: string;
}

interface GraphQLBody {
  readonly data?: unknown;
  readonly errors?: readonly { message: string; extensions?: { code?: unknown } }[];
  /** The API's own JSON errors outside GraphQL, e.g. 429 RATE_LIMITED. */
  readonly error?: unknown;
}

/** Same origin: CloudFront (prod) or the Vite proxy (dev) routes this to the API. */
const endpoint = () => new URL('/admin/graphql', window.location.origin).toString();

/**
 * RTK Query's transport for GraphQL. GraphQL errors (UNAUTHENTICATED, FORBIDDEN…) become RTK
 * Query errors with their code; `userErrors` stay part of the data, for forms to show.
 */
export const graphqlBaseQuery: BaseQueryFn<GraphQLRequest, unknown, AdminApiError> = async (
  { document, variables },
  { signal },
) => {
  let response: Response;
  try {
    response = await fetch(endpoint(), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: document.toString(), variables }),
      signal,
    });
  } catch {
    return { error: { code: 'NETWORK', message: 'Network error' } };
  }
  let body: GraphQLBody;
  try {
    body = (await response.json()) as GraphQLBody;
  } catch {
    return { error: { code: 'generic', message: `HTTP ${String(response.status)}` } };
  }
  const first = body.errors?.[0];
  if (first) {
    const code = first.extensions?.code;
    return { error: { code: typeof code === 'string' ? code : 'generic', message: first.message } };
  }
  if (typeof body.error === 'string') return { error: { code: body.error, message: body.error } };
  if (!response.ok || body.data == null) {
    return { error: { code: 'generic', message: `HTTP ${String(response.status)}` } };
  }
  return { data: body.data };
};
