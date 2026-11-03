import { createListenerMiddleware, isRejectedWithValue } from '@reduxjs/toolkit';
import type { AdminApiError } from '@admin/api/baseQuery';
import { adminApi } from '@admin/api/adminApi';
import { errorMessage } from '@admin/i18n/t';
import { organizationViewed } from '../slices/recentOrganizations';
import { toastAdded } from '../slices/toasts';

/**
 * Listener middleware: side effects that react to actions, kept out of reducers and components.
 * - A failed request becomes an error toast (PLAN E10-4: the rollback of an optimistic suspend
 *   is announced this way). UNAUTHENTICATED is the session middleware's job, not a toast.
 * - Opening an organisation records it in "Recently viewed".
 */
export const listeners = createListenerMiddleware();

listeners.startListening({
  predicate: (action) => isRejectedWithValue(action),
  effect: (action, api) => {
    if (!isRejectedWithValue(action)) return;
    const error = action.payload as AdminApiError | undefined;
    if (!error || error.code === 'UNAUTHENTICATED') return;
    api.dispatch(toastAdded({ tone: 'error', message: errorMessage(error.code) }));
  },
});

listeners.startListening({
  matcher: adminApi.endpoints.organization.matchFulfilled,
  effect: (action, api) => {
    const org = action.payload;
    if (!org) return;
    api.dispatch(
      organizationViewed({ id: org.id, name: org.name, slug: org.slug, viewedAt: Date.now() }),
    );
  },
});
