import { noPreferenceEffects } from '@web/test/render';
import { describe, expect, it, vi } from 'vitest';
import { makeStore } from '../store';
import { navToggled, themeChanged } from '../slices/ui';
import { toastAdded } from '../slices/toasts';
import { analyticsMiddleware, discardSink, TRACKED_ACTIONS, type AnalyticsSink } from './analytics';
import { browserPreferenceEffects, THEME_COOKIE } from './preferences';

describe('preferences listener middleware', () => {
  it('persists and applies the theme when it changes, and only then', () => {
    const effects = { writeCookie: vi.fn(), applyTheme: vi.fn() };
    const store = makeStore({ preferenceEffects: effects, analytics: discardSink });
    store.dispatch(navToggled());
    expect(effects.writeCookie).not.toHaveBeenCalled();
    store.dispatch(themeChanged('dark'));
    expect(effects.writeCookie).toHaveBeenCalledWith(THEME_COOKIE, 'dark');
    expect(effects.applyTheme).toHaveBeenCalledWith('dark');
  });

  it('browser effects write a readable, same-site cookie and set data-theme', () => {
    browserPreferenceEffects.writeCookie(THEME_COOKIE, 'light');
    expect(document.cookie).toContain(`${THEME_COOKIE}=light`);
    browserPreferenceEffects.applyTheme('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    browserPreferenceEffects.applyTheme('system');
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });
});

describe('analytics middleware', () => {
  it('forwards tracked action types only, with no payload', () => {
    const sink: AnalyticsSink = { send: vi.fn() };
    const store = makeStore({ preferenceEffects: noPreferenceEffects, analytics: sink });
    store.dispatch(toastAdded({ tone: 'info', message: 'secret customer name' }));
    store.dispatch(navToggled());
    expect(sink.send).toHaveBeenCalledTimes(1);
    expect(sink.send).toHaveBeenCalledWith({ type: 'ui/navToggled', at: expect.any(Number) });
    expect(TRACKED_ACTIONS.has('toasts/toastAdded')).toBe(false);
  });

  it('never breaks the app when the sink throws, and always passes the action on', () => {
    const next = vi.fn((action: unknown) => action);
    const failing: AnalyticsSink = {
      send() {
        throw new Error('network down');
      },
    };
    const action = navToggled();
    const result = analyticsMiddleware(failing, () => 1)({ dispatch: vi.fn(), getState: vi.fn() })(
      next,
    )(action);
    expect(next).toHaveBeenCalledWith(action);
    expect(result).toBe(action);
  });
});
