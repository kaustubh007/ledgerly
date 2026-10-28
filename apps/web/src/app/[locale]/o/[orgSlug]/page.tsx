import { getTranslations } from 'next-intl/server';
import { CurrencyTotals } from '@web/features/dashboard/CurrencyTotals';
import { DashboardQuery } from '@web/graphql/documents';
import { forOrg, query } from '@web/lib/apollo/rsc';

export default async function DashboardPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const t = await getTranslations('dashboard');
  // Pages render in parallel with their layout. If the layout ends up showing RestoreSession or
  // a 404, this query fails too and its result is discarded; 'all' keeps that from being logged
  // as a crash.
  const { data } = await query({
    query: DashboardQuery,
    context: forOrg(orgSlug),
    fetchPolicy: 'no-cache',
    errorPolicy: 'all',
  });
  const invoices = data?.dashboard.countsByStatus.reduce((sum, row) => sum + row.count, 0) ?? 0;

  return (
    <>
      <h1>{t('title')}</h1>
      <p>{t('invoiceCount', { count: invoices })}</p>
      <CurrencyTotals totals={data?.dashboard.totals ?? []} />
    </>
  );
}
