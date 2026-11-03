import { redirect, type RouteObject } from 'react-router';
import { signInAction, signOutAction, verifyAction } from '@admin/features/auth/actions';
import { RecoveryCodesPage } from '@admin/features/auth/RecoveryCodesPage';
import { SignInPage } from '@admin/features/auth/SignInPage';
import { VerifyPage } from '@admin/features/auth/VerifyPage';
import { requireStaff } from '@admin/features/layout/requireStaff';
import { RootLayout } from '@admin/features/layout/RootLayout';
import { RouteError } from '@admin/features/layout/RouteError';
import {
  OrganizationsPage,
  organizationsLoader,
} from '@admin/features/organizations/OrganizationsPage';
import type { AppStore } from '@admin/store/store';

/**
 * The route tree (React Router data mode). A function of the store, so loaders and actions use
 * the same RTK Query cache as the components, and tests can build it around a test store.
 *
 *   /sign-in, /sign-in/verify, /sign-in/recovery-codes   public, with actions
 *   /                                                     layout; its middleware is the guard
 *     organizations                                       list (loader prefetches)
 *     organizations/:organizationId                       detail (lazy, 404 → errorElement)
 *     audit                                               audit log (lazy)
 */
export function createRoutes(store: AppStore): RouteObject[] {
  return [
    { path: '/sign-in', element: <SignInPage />, action: signInAction(store) },
    { path: '/sign-in/verify', element: <VerifyPage />, action: verifyAction(store) },
    { path: '/sign-in/recovery-codes', element: <RecoveryCodesPage /> },
    { path: '/sign-out', action: signOutAction(store) },
    {
      id: 'root',
      path: '/',
      element: <RootLayout />,
      middleware: [requireStaff(store)],
      errorElement: <RouteError />,
      children: [
        { index: true, loader: () => redirect('/organizations') },
        {
          // Errors in a child render inside the layout, keeping navigation on screen.
          errorElement: <RouteError />,
          children: [
            {
              path: 'organizations',
              element: <OrganizationsPage />,
              loader: organizationsLoader(store),
            },
            {
              path: 'organizations/:organizationId',
              lazy: async () => {
                const page = await import('@admin/features/organizations/OrganizationPage');
                return { Component: page.OrganizationPage, loader: page.organizationLoader(store) };
              },
            },
            {
              path: 'audit',
              lazy: async () => {
                const page = await import('@admin/features/audit/AuditLogPage');
                return { Component: page.AuditLogPage, loader: page.auditLogLoader(store) };
              },
            },
          ],
        },
      ],
    },
  ];
}
