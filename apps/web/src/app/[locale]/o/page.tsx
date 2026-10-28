import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { ViewerQuery } from '@web/graphql/documents';
import { RestoreSession } from '@web/lib/auth/RestoreSession';
import { query } from '@web/lib/apollo/rsc';

/** Picks the organisation: the first membership, or explains there is none. */
export default async function OrgPicker({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { data } = await query({ query: ViewerQuery, fetchPolicy: 'no-cache' });
  const viewer = data?.viewer;
  if (!viewer) return <RestoreSession />;

  const first = viewer.memberships[0];
  if (first) redirect(`/${locale}/o/${first.organization.slug}`);

  const t = await getTranslations('orgPicker');
  return (
    <main id="content" style={{ padding: 'var(--space-4)' }}>
      <h1>{t('title')}</h1>
      <p>{t('none')}</p>
    </main>
  );
}
