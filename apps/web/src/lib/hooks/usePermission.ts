'use client';

import { can, type Permission } from '@ledgerly/domain';
import { useAppSelector } from '@web/store/hooks';
import { selectActiveOrg } from '@web/store/slices/session';

/**
 * Whether the current member may do `permission` in the active organisation, using the same
 * table as the API (@ledgerly/domain). For *hiding* actions only: the API decides for real.
 */
export function usePermission(permission: Permission): boolean {
  const role = useAppSelector(selectActiveOrg)?.role;
  return role !== undefined && can(role, permission);
}
