'use client';

import { useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeStore, type RootState, type StoreOptions } from './store';

/**
 * Creates the store once per mount: once per request on the server, once per page load in the
 * browser. `useState`'s initialiser runs exactly once, so re-renders keep the same store.
 */
export function StoreProvider({
  preloadedState,
  options,
  children,
}: {
  preloadedState?: Partial<RootState>;
  options?: Omit<StoreOptions, 'preloadedState'>;
  children: ReactNode;
}) {
  const [store] = useState(() =>
    makeStore({ ...options, ...(preloadedState ? { preloadedState } : {}) }),
  );
  return <Provider store={store}>{children}</Provider>;
}
