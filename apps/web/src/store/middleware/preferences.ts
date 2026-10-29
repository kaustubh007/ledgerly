import { createListenerMiddleware } from '@reduxjs/toolkit';
import { themeChanged, type ThemePreference } from '../slices/ui';

export const THEME_COOKIE = 'ledgerly-theme';

export interface PreferenceEffects {
  /** Persists the preference so the server can render the right theme on the next request. */
  writeCookie(name: string, value: string): void;
  /** Applies it to the document right away. */
  applyTheme(theme: ThemePreference): void;
}

export const browserPreferenceEffects: PreferenceEffects = {
  writeCookie(name, value) {
    // A preference, not a secret: readable by JS on purpose, one year, same site only.
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  },
  applyTheme(theme) {
    if (theme === 'system') delete document.documentElement.dataset['theme'];
    else document.documentElement.dataset['theme'] = theme;
  },
};

/**
 * Listener middleware: side effects in response to actions, kept out of reducers (which must
 * stay pure) and out of components (which would each have to remember to do it).
 */
export function createPreferencesListener(effects: PreferenceEffects) {
  const listener = createListenerMiddleware();
  listener.startListening({
    actionCreator: themeChanged,
    effect: (action) => {
      effects.writeCookie(THEME_COOKIE, action.payload);
      effects.applyTheme(action.payload);
    },
  });
  return listener;
}
