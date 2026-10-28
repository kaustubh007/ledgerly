import { ApolloLink, CombinedGraphQLErrors } from '@apollo/client';
import { ErrorLink } from '@apollo/client/link/error';
import { from, mergeMap, throwError } from 'rxjs';
import type { Refresher } from '../auth/refresh';

export const ORG_HEADER = 'x-org';

/** `/{locale}/o/{slug}/…` → `slug`. The URL is the source of truth for the active org (§3.6). */
export function orgSlugFromPath(pathname: string): string | undefined {
  return /^\/[a-z]{2}\/o\/([^/]+)/.exec(pathname)?.[1];
}

/** Adds `x-org` from the current URL (browser) unless the operation set one explicitly. */
export function orgHeaderLink(currentPath: () => string): ApolloLink {
  return new ApolloLink((operation, forward) => {
    const slug = orgSlugFromPath(currentPath());
    if (slug) {
      operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
        headers: { [ORG_HEADER]: slug, ...headers },
      }));
    }
    return forward(operation);
  });
}

export function isUnauthenticated(error: unknown): boolean {
  return (
    CombinedGraphQLErrors.is(error) &&
    error.errors.some((e) => e.extensions?.['code'] === 'UNAUTHENTICATED')
  );
}

/**
 * On UNAUTHENTICATED: refresh the session once (shared with every other request and tab),
 * then retry the operation once. If the refresh is refused, the session is over.
 */
export function refreshOnUnauthenticatedLink(
  refresher: Refresher,
  onSessionExpired: () => void,
): ApolloLink {
  return new ErrorLink(({ error, operation, forward }) => {
    if (!isUnauthenticated(error) || operation.getContext()['retriedAfterRefresh'] === true) return;
    return from(refresher.refresh()).pipe(
      mergeMap((ok) => {
        if (!ok) {
          onSessionExpired();
          return throwError(() => error);
        }
        operation.setContext({ retriedAfterRefresh: true });
        return forward(operation);
      }),
    );
  });
}
