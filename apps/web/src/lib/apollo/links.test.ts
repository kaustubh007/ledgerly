import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
} from '@apollo/client';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { Refresher } from '../auth/refresh';
import {
  isUnauthenticated,
  ORG_HEADER,
  orgHeaderLink,
  orgSlugFromPath,
  refreshOnUnauthenticatedLink,
} from './links';

const QUERY = gql`
  query Probe {
    probe
  }
`;

function refresher(ok: boolean): Refresher {
  return {
    refresh: vi.fn(async () => ok),
    announceSignedOut: vi.fn(),
    onSignedOut: vi.fn(() => () => undefined),
  };
}

/** A fake server: UNAUTHENTICATED until `authorised` flips, recording headers it saw. */
function fakeServer() {
  const state = { authorised: false, calls: 0, headers: [] as Record<string, string>[] };
  const link = new ApolloLink((operation) => {
    state.calls += 1;
    state.headers.push((operation.getContext()['headers'] ?? {}) as Record<string, string>);
    return of(
      state.authorised
        ? { data: { probe: 'ok' } }
        : { errors: [{ message: 'Sign in', extensions: { code: 'UNAUTHENTICATED' } }] },
    );
  });
  return { state, link };
}

const client = (link: ApolloLink) => new ApolloClient({ link, cache: new InMemoryCache() });

describe('orgSlugFromPath', () => {
  it.each([
    ['/en/o/acme', 'acme'],
    ['/de/o/acme/customers', 'acme'],
    ['/en/sign-in', undefined],
    ['/en/o', undefined],
  ])('%s → %s', (path, slug) => {
    expect(orgSlugFromPath(path)).toBe(slug);
  });
});

describe('orgHeaderLink', () => {
  it('sends x-org from the URL, unless the operation set one', async () => {
    const server = fakeServer();
    server.state.authorised = true;
    const c = client(ApolloLink.from([orgHeaderLink(() => '/en/o/acme/customers'), server.link]));
    await c.query({ query: QUERY, fetchPolicy: 'no-cache' });
    await c.query({
      query: QUERY,
      fetchPolicy: 'no-cache',
      context: { headers: { [ORG_HEADER]: 'explicit' } },
    });
    expect(server.state.headers.map((h) => h[ORG_HEADER])).toEqual(['acme', 'explicit']);
  });
});

describe('refreshOnUnauthenticatedLink', () => {
  it('refreshes once and retries the operation once', async () => {
    const server = fakeServer();
    const r = refresher(true);
    vi.mocked(r.refresh).mockImplementation(async () => {
      server.state.authorised = true;
      return true;
    });
    const expired = vi.fn();
    const c = client(ApolloLink.from([refreshOnUnauthenticatedLink(r, expired), server.link]));
    const { data } = await c.query({ query: QUERY, fetchPolicy: 'no-cache' });
    expect(data).toEqual({ probe: 'ok' });
    expect(r.refresh).toHaveBeenCalledTimes(1);
    expect(server.state.calls).toBe(2);
    expect(expired).not.toHaveBeenCalled();
  });

  it('gives up after one retry instead of looping', async () => {
    const server = fakeServer();
    const r = refresher(true); // the refresh "works" but the server still says no
    const c = client(ApolloLink.from([refreshOnUnauthenticatedLink(r, vi.fn()), server.link]));
    await expect(c.query({ query: QUERY, fetchPolicy: 'no-cache' })).rejects.toSatisfy(
      isUnauthenticated,
    );
    expect(server.state.calls).toBe(2);
  });

  it('declares the session over when the refresh is refused', async () => {
    const server = fakeServer();
    const expired = vi.fn();
    const c = client(
      ApolloLink.from([refreshOnUnauthenticatedLink(refresher(false), expired), server.link]),
    );
    await expect(c.query({ query: QUERY, fetchPolicy: 'no-cache' })).rejects.toBeInstanceOf(
      CombinedGraphQLErrors,
    );
    expect(expired).toHaveBeenCalledTimes(1);
    expect(server.state.calls).toBe(1);
  });

  it('leaves other errors alone', async () => {
    const r = refresher(true);
    const failing = new ApolloLink(() =>
      of({ errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }] }),
    );
    const c = client(ApolloLink.from([refreshOnUnauthenticatedLink(r, vi.fn()), failing]));
    await expect(c.query({ query: QUERY, fetchPolicy: 'no-cache' })).rejects.toBeInstanceOf(
      CombinedGraphQLErrors,
    );
    expect(r.refresh).not.toHaveBeenCalled();
  });
});
