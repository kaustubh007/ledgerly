import { combineSlices, configureStore } from '@reduxjs/toolkit';
import {
  analyticsMiddleware,
  consoleSink,
  discardSink,
  type AnalyticsSink,
} from './middleware/analytics';
import {
  browserPreferenceEffects,
  createPreferencesListener,
  type PreferenceEffects,
} from './middleware/preferences';
import { sessionSlice } from './slices/session';
import { toastsSlice } from './slices/toasts';
import { uiSlice } from './slices/ui';

const rootReducer = combineSlices(uiSlice, toastsSlice, sessionSlice);
export type RootState = ReturnType<typeof rootReducer>;

export interface StoreOptions {
  readonly preloadedState?: Partial<RootState>;
  readonly preferenceEffects?: PreferenceEffects;
  readonly analytics?: AnalyticsSink;
}

/**
 * A *factory*, not a module-level store. On the server, one Node process renders many users'
 * requests; a shared store would leak one user's state into another's HTML. Each request (and
 * each browser tab) gets its own store from StoreProvider.
 */
export function makeStore(options: StoreOptions = {}) {
  const preferences = createPreferencesListener(
    options.preferenceEffects ?? browserPreferenceEffects,
  );
  const sink =
    options.analytics ?? (process.env.NODE_ENV === 'development' ? consoleSink : discardSink);
  return configureStore({
    reducer: rootReducer,
    ...(options.preloadedState ? { preloadedState: options.preloadedState } : {}),
    middleware: (getDefault) =>
      getDefault().prepend(preferences.middleware).concat(analyticsMiddleware(sink)),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
