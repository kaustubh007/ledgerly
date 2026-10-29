import { ApolloLink, HttpLink } from '@apollo/client';
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from '@apollo/client-integration-nextjs';
import { SetContextLink } from '@apollo/client/link/context';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE, apiUrl } from '../server-config';

// Apollo for React Server Components: one client per request (registerApolloClient caches it
// for the request's lifetime). It calls the API directly over the internal network, as the
// signed-in user: it forwards the access cookie, and only that cookie (ADR-0001). It never
// sees the refresh token, whose cookie is scoped to /graphql/auth.
export const { getClient, query, PreloadQuery } = registerApolloClient(
  () =>
    new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([
        new SetContextLink(async (previous) => {
          const access = (await cookies()).get(ACCESS_COOKIE)?.value;
          const headers = (previous['headers'] ?? {}) as Record<string, string>;
          return {
            headers: access ? { ...headers, cookie: `${ACCESS_COOKIE}=${access}` } : headers,
          };
        }),
        new HttpLink({ uri: `${apiUrl()}/graphql` }),
      ]),
    }),
);

/** Operation context selecting the organisation, for server-side queries. */
export function forOrg(slug: string) {
  return { headers: { 'x-org': slug } };
}
