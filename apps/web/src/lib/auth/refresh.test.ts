import { describe, expect, it, vi } from 'vitest';
import { createRefresher, CSRF_HEADER, REFRESH_URL, type RefreshDeps } from './refresh';

function ok(): Response {
  return new Response(null, { status: 204 });
}

/** A BroadcastChannel stand-in connecting refreshers created with the same bus. */
function bus() {
  const listeners: ((event: MessageEvent) => void)[] = [];
  return () => {
    let own: ((event: MessageEvent) => void) | undefined;
    return {
      addEventListener: (_: string, listener: (event: MessageEvent) => void) => {
        own = listener;
        listeners.push(listener);
      },
      postMessage: (data: unknown) => {
        for (const listener of listeners) if (listener !== own) listener({ data } as MessageEvent);
      },
    } as unknown as BroadcastChannel;
  };
}

/** navigator.locks stand-in: runs callbacks one at a time. */
function lockManager(): Pick<LockManager, 'request'> {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    request: ((_: string, callback: () => Promise<unknown>) => {
      const run = tail.then(callback);
      tail = run.catch(() => undefined);
      return run;
    }) as LockManager['request'],
  };
}

describe('refresher', () => {
  it('calls the refresh endpoint with the CSRF header', async () => {
    const fetch = vi.fn(async () => ok());
    expect(await createRefresher({ fetch, now: Date.now }).refresh()).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      REFRESH_URL,
      expect.objectContaining({ method: 'POST', headers: { [CSRF_HEADER]: '1' } }),
    );
  });

  it('shares one in-flight refresh between concurrent callers in a tab', async () => {
    let release: (r: Response) => void = () => undefined;
    const fetch = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));
    const refresher = createRefresher({ fetch, now: Date.now });
    const calls = [refresher.refresh(), refresher.refresh(), refresher.refresh()];
    release(ok());
    expect(await Promise.all(calls)).toEqual([true, true, true]);
    expect(fetch).toHaveBeenCalledTimes(1);
    // …and once it has settled, the next call starts a new attempt.
    const later = refresher.refresh();
    release(ok());
    await later;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('makes one network call for several tabs refreshing at once', async () => {
    const fetch = vi.fn(async () => ok());
    const channel = bus();
    const locks = lockManager();
    let clock = 1000;
    const deps = (): RefreshDeps => ({ fetch, now: () => (clock += 1), locks, channel: channel() });
    const tabs = [createRefresher(deps()), createRefresher(deps()), createRefresher(deps())];
    expect(await Promise.all(tabs.map((t) => t.refresh()))).toEqual([true, true, true]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports failure when the server refuses or the network fails', async () => {
    expect(
      await createRefresher({
        fetch: async () => new Response(null, { status: 401 }),
        now: Date.now,
      }).refresh(),
    ).toBe(false);
    expect(
      await createRefresher({
        fetch: async () => {
          throw new TypeError('offline');
        },
        now: Date.now,
      }).refresh(),
    ).toBe(false);
  });

  it('tells other tabs about a sign-out', () => {
    const channel = bus();
    const a = createRefresher({ fetch: async () => ok(), now: Date.now, channel: channel() });
    const b = createRefresher({ fetch: async () => ok(), now: Date.now, channel: channel() });
    const listener = vi.fn();
    const unsubscribe = b.onSignedOut(listener);
    a.announceSignedOut();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    a.announceSignedOut();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
