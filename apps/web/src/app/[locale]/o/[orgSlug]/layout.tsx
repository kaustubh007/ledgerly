import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@web/features/shell/AppShell';
import { OrgShellQuery } from '@web/graphql/documents';
import { forOrg, query } from '@web/lib/apollo/rsc';
import { RestoreSession } from '@web/lib/auth/RestoreSession';
import { parseTheme } from '@web/lib/theme';
import { THEME_COOKIE } from '@web/store/middleware/preferences';
import { StoreProvider } from '@web/store/StoreProvider';
import { initialUiState } from '@web/store/slices/ui';

/**
 * The organisation area. A Server Component: it asks the API, as the user and for this org,
 * who the user is and what the org is, before any HTML is sent. Then it hands that to a
 * per-request Redux store for the client components in the shell.
 */
export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { data } = await query({
    query: OrgShellQuery,
    context: forOrg(orgSlug),
    fetchPolicy: 'no-cache',
    // FORBIDDEN on `organization` still returns `viewer`; we want both answers.
    errorPolicy: 'all',
  });

  if (!data?.viewer) return <RestoreSession />;
  // Not a member, or no such org: indistinguishable on purpose (no org enumeration).
  if (!data.organization) notFound();

  const { viewer, organization } = data;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const memberships = viewer.memberships.map((m) => ({
    slug: m.organization.slug,
    name: m.organization.name,
    role: m.role,
  }));

  return (
    <StoreProvider
      preloadedState={{
        ui: { ...initialUiState, theme },
        session: {
          viewer: { id: viewer.id, name: viewer.name, email: viewer.email },
          activeOrg: {
            slug: organization.slug,
            name: organization.name,
            role: organization.viewerRole,
          },
          memberships,
        },
      }}
    >
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
