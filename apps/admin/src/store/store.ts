import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { adminApi } from '@admin/api/adminApi';
import { listeners } from './middleware/errorToasts';
import { sessionExpiredMiddleware } from './middleware/sessionExpired';
import { authFlowSlice } from './slices/auth';
import { recentOrganizationsSlice } from './slices/recentOrganizations';
import { toastsSlice } from './slices/toasts';

const rootReducer = combineSlices(adminApi, toastsSlice, recentOrganizationsSlice, authFlowSlice);

export type RootState = ReturnType<typeof rootReducer>;

export interface StoreOptions {
  /** Called when the session ends; the app navigates to sign-in. */
  readonly onSignedOut: () => void;
  readonly preloadedState?: Partial<RootState>;
}

/** A factory, not a module-level store: each test (and the app) gets its own. */
export function makeStore({ onSignedOut, preloadedState }: StoreOptions) {
  return configureStore({
    reducer: rootReducer,
    ...(preloadedState ? { preloadedState } : {}),
    middleware: (getDefault) =>
      getDefault()
        .prepend(listeners.middleware)
        .concat(adminApi.middleware, sessionExpiredMiddleware(onSignedOut)),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
