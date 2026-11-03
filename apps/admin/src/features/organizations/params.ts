import type { OrganizationStatus } from '@admin/graphql/__generated__/graphql';

export const PAGE_SIZE = 20;

/** The list's state lives in the URL (?q=&status=&after=): shareable, back-button friendly. */
/** A search param, with an empty value (an empty form field) read as absent. */
export function param(params: URLSearchParams, name: string): string | null {
  const value = params.get(name);
  return value === null || value === '' ? null : value;
}

export function listArgs(params: URLSearchParams): {
  search: string | null;
  status: OrganizationStatus | null;
  after: string | null;
  first: number;
} {
  const status = param(params, 'status');
  return {
    search: param(params, 'q'),
    status: status === 'ACTIVE' || status === 'SUSPENDED' ? status : null,
    after: param(params, 'after'),
    first: PAGE_SIZE,
  };
}
