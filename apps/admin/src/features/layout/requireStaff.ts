import { redirect, type MiddlewareFunction } from 'react-router';
import { loadMe } from '@admin/api/load';
import type { AppStore } from '@admin/store/store';

/**
 * Route guard, as route middleware: it runs before any loader under the layout. A loader would
 * run in parallel with the page's own loader, which would ask the API for data first and race
 * the redirect. No staff session means sign-in, coming back here afterwards. The API checks
 * every request anyway; this is UX, not security.
 */
export const requireStaff =
  (store: AppStore): MiddlewareFunction =>
  async ({ request }, next) => {
    const me = await loadMe(store);
    if (!me) {
      const url = new URL(request.url);
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router: a thrown redirect stops the navigation
      throw redirect(`/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`);
    }
    return next();
  };
