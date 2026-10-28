'use client';

import { ApolloLink, HttpLink } from '@apollo/client';
import {
  ApolloClient,
  ApolloNextAppProvider,
  InMemoryCache,
} from '@apollo/client-integration-nextjs';
import type { ReactNode } from 'react';
import { throwError } from 'rxjs';
import { signInPath } from '../auth/paths';
import { getRefresher } from '../auth/refresh';
import { orgHeaderLink, refreshOnUnauthenticatedLink } from './links';

function sessionExpired(): void {
  getRefresher().announceSignedOut();
  window.location.assign(signInPath(window.location.pathname));
}

function makeClient(): ApolloClient {
  if (typeof window === 'undefined') {
    // Client components are also rendered on the server, where there is no browser cookie jar.
    // Authenticated data for the first render comes from Server Components (query or
    // PreloadQuery); a client component that fetches during SSR is a bug, so say so loudly.
    return new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink((operation) =>
        throwError(
          () =>
            new Error(
              `"${operation.operationName ?? 'anonymous'}" ran during SSR. Preload it in a Server Component with <PreloadQuery>.`,
            ),
        ),
      ),
    });
  }
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.from([
      refreshOnUnauthenticatedLink(getRefresher(), sessionExpired),
      orgHeaderLink(() => window.location.pathname),
      // Same origin: /graphql is routed to the API by CloudFront (prod) or a rewrite (dev).
      new HttpLink({ uri: '/graphql', credentials: 'same-origin' }),
    ]),
  });
}

export function ApolloWrapper({ children }: { children: ReactNode }) {
  return <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>;
}
