import type {
  OrganizationsQueryVariables,
  AuditLogQueryVariables,
} from '@admin/graphql/__generated__/graphql';
import type { AppStore } from '@admin/store/store';
import { adminApi } from './adminApi';

// Route loaders start the request before the page renders (React Router data mode), into the
// same RTK Query cache the page reads, then let go: the page's own hook subscribes and finds
// the data already there. No waterfall, no second request.

async function load<T>(request: { unwrap(): Promise<T>; unsubscribe(): void }): Promise<T> {
  try {
    return await request.unwrap();
  } finally {
    request.unsubscribe();
  }
}

export const loadMe = (store: AppStore) => load(store.dispatch(adminApi.endpoints.me.initiate()));

export const loadOrganizations = (store: AppStore, args: OrganizationsQueryVariables) =>
  load(store.dispatch(adminApi.endpoints.organizations.initiate(args)));

export const loadOrganization = (store: AppStore, id: string) =>
  load(store.dispatch(adminApi.endpoints.organization.initiate(id)));

export const loadAuditLog = (store: AppStore, args: AuditLogQueryVariables) =>
  load(store.dispatch(adminApi.endpoints.auditLog.initiate(args)));
