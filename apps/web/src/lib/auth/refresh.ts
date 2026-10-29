// Single-flight session refresh (ADR-0003). The access cookie expires every 10 minutes; when a
// request fails with UNAUTHENTICATED, the app calls refreshSession() and retries.
//
// - Within a tab: concurrent callers share one in-flight promise.
// - Across tabs: a Web Lock serialises refreshes, and a BroadcastChannel tells waiting tabs that
//   one already happened, so N tabs make one network call. (Cookies are shared, so the new
//   access cookie is already theirs.) The server's 20 s grace window is the backstop when the
//   browser has neither API.

export const REFRESH_URL = '/graphql/auth/refresh';
export const CSRF_HEADER = 'x-ledgerly-csrf';
const LOCK = 'ledgerly-session-refresh';
const CHANNEL = 'ledgerly-session';

type Message =
  { readonly type: 'refreshed'; readonly at: number } | { readonly type: 'signed-out' };

export interface RefreshDeps {
  readonly fetch: typeof fetch;
  readonly now: () => number;
  /** `navigator.locks`, when available. */
  readonly locks?: Pick<LockManager, 'request'>;
  /** A channel shared with other tabs, when available. */
  readonly channel?: Pick<BroadcastChannel, 'postMessage' | 'addEventListener'>;
}

export interface Refresher {
  /** Resolves true if the session is live again, false if the user must sign in. */
  refresh(): Promise<boolean>;
  /** Tells every tab the session ended (sign-out, or refresh refused). */
  announceSignedOut(): void;
  onSignedOut(listener: () => void): () => void;
}

export function createRefresher(deps: RefreshDeps): Refresher {
  let inFlight: Promise<boolean> | undefined;
  let lastRefreshedAt = 0;
  const signedOutListeners = new Set<() => void>();

  deps.channel?.addEventListener('message', (event: MessageEvent<Message>) => {
    if (event.data.type === 'refreshed') lastRefreshedAt = Math.max(lastRefreshedAt, event.data.at);
    else
      signedOutListeners.forEach((listener) => {
        listener();
      });
  });

  async function callServer(): Promise<boolean> {
    const response = await deps.fetch(REFRESH_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { [CSRF_HEADER]: '1' },
    });
    return response.ok;
  }

  async function run(): Promise<boolean> {
    const startedAt = deps.now();
    const attempt = async (): Promise<boolean> => {
      // Another tab refreshed after we started waiting for the lock: its cookie is ours too.
      // Strictly after: a refresh that finished in the same millisecond we started may predate
      // the 401 that sent us here.
      if (lastRefreshedAt > startedAt) return true;
      const ok = await callServer();
      if (ok) {
        lastRefreshedAt = deps.now();
        deps.channel?.postMessage({ type: 'refreshed', at: lastRefreshedAt } satisfies Message);
      }
      return ok;
    };
    return deps.locks ? deps.locks.request(LOCK, attempt) : attempt();
  }

  return {
    refresh() {
      inFlight ??= run()
        .catch(() => false)
        .finally(() => {
          inFlight = undefined;
        });
      return inFlight;
    },
    announceSignedOut() {
      deps.channel?.postMessage({ type: 'signed-out' } satisfies Message);
    },
    onSignedOut(listener) {
      signedOutListeners.add(listener);
      return () => signedOutListeners.delete(listener);
    },
  };
}

let browserRefresher: Refresher | undefined;

/** The tab's refresher, created on first use in the browser. */
export function getRefresher(): Refresher {
  browserRefresher ??= createRefresher({
    fetch: (...args) => fetch(...args),
    now: () => Date.now(),
    ...(typeof navigator !== 'undefined' && 'locks' in navigator ? { locks: navigator.locks } : {}),
    ...(typeof BroadcastChannel !== 'undefined' ? { channel: new BroadcastChannel(CHANNEL) } : {}),
  });
  return browserRefresher;
}
