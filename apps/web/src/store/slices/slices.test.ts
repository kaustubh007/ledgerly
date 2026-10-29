import { noPreferenceEffects } from '@web/test/render';
import { describe, expect, it } from 'vitest';
import { makeStore } from '../store';
import { discardSink } from '../middleware/analytics';
import { initialSessionState, selectOtherOrgs, sessionLoaded, signedOut } from './session';
import { MAX_TOASTS, toastAdded, toastDismissed } from './toasts';
import { navClosed, navToggled, themeChanged } from './ui';

const store = () => makeStore({ preferenceEffects: noPreferenceEffects, analytics: discardSink });

describe('ui slice', () => {
  it('toggles and closes the navigation and records the theme', () => {
    const s = store();
    s.dispatch(navToggled());
    expect(s.getState().ui.navOpen).toBe(true);
    s.dispatch(navClosed());
    expect(s.getState().ui.navOpen).toBe(false);
    s.dispatch(themeChanged('dark'));
    expect(s.getState().ui.theme).toBe('dark');
  });
});

describe('toasts slice', () => {
  it('gives each toast a unique id (in prepare, so the reducer stays pure)', () => {
    const a = toastAdded({ tone: 'info', message: 'x' });
    const b = toastAdded({ tone: 'info', message: 'x' });
    expect(a.payload.id).not.toBe(b.payload.id);
  });

  it(`keeps at most ${String(MAX_TOASTS)}, dropping the oldest, and dismisses by id`, () => {
    const s = store();
    for (const n of [1, 2, 3, 4]) s.dispatch(toastAdded({ tone: 'info', message: String(n) }));
    expect(s.getState().toasts.map((t) => t.message)).toEqual(['2', '3', '4']);
    const first = s.getState().toasts[0];
    s.dispatch(toastDismissed(first?.id ?? ''));
    expect(s.getState().toasts.map((t) => t.message)).toEqual(['3', '4']);
  });
});

describe('session slice', () => {
  const loaded = {
    viewer: { id: 'u1', name: 'Ada', email: 'a@x.io' },
    activeOrg: { slug: 'a', name: 'A', role: 'OWNER' as const },
    memberships: [
      { slug: 'a', name: 'A', role: 'OWNER' as const },
      { slug: 'b', name: 'B', role: 'VIEWER' as const },
    ],
  };

  it('loads the session the server provided and lists the other organisations', () => {
    const s = store();
    s.dispatch(sessionLoaded(loaded));
    expect(selectOtherOrgs(s.getState()).map((o) => o.slug)).toEqual(['b']);
  });

  it('forgets everything on sign-out', () => {
    const s = store();
    s.dispatch(sessionLoaded(loaded));
    s.dispatch(signedOut());
    expect(s.getState().session).toEqual(initialSessionState);
  });
});
