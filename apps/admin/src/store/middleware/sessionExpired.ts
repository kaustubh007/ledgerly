import { isRejectedWithValue, type Middleware } from '@reduxjs/toolkit';
import type { AdminApiError } from '@admin/api/baseQuery';
import { adminApi } from '@admin/api/adminApi';
import { authFlowCleared } from '../slices/auth';

/**
 * A hand-written middleware: it sees every action. When any request comes back UNAUTHENTICATED
 * (the 30-minute idle or 8-hour limit passed, or the session was revoked), it drops all cached
 * server data and sends the staff member to sign-in. One place, instead of every page.
 */
export function sessionExpiredMiddleware(onSignedOut: () => void): Middleware {
  return (api) => (next) => (action) => {
    const result = next(action);
    if (
      isRejectedWithValue(action) &&
      (action.payload as AdminApiError | undefined)?.code === 'UNAUTHENTICATED'
    ) {
      api.dispatch(adminApi.util.resetApiState());
      api.dispatch(authFlowCleared());
      onSignedOut();
    }
    return result;
  };
}
