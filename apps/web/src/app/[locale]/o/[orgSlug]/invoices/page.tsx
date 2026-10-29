import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { INVOICE_PAGE_SIZE, STATUSES } from '@web/features/invoices/constants';
import { InvoiceFilters } from '@web/features/invoices/InvoiceFilters';
import { InvoiceTable } from '@web/features/invoices/InvoiceTable';
import type { InvoiceStatus } from '@web/graphql/__generated__/graphql';
import { CustomerOptionsQuery, InvoicesQuery } from '@web/graphql/documents';
import { Link } from '@web/i18n/navigation';
import { forOrg, PreloadQuery, query } from '@web/lib/apollo/rsc';

/** Only values the API accepts get through; anything else in the URL means "no filter". */
function statusFrom(value: string | string[] | undefined): InvoiceStatus | null {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value)
    ? (value as InvoiceStatus)
    : null;
}

export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgSlug }, search] = await Promise.all([params, searchParams]);
  const t = await getTranslations('invoices');
  const status = statusFrom(search['status']);
  const customerId = typeof search['customer'] === 'string' ? search['customer'] : null;
  const { data } = await query({
    query: CustomerOptionsQuery,
    context: forOrg(orgSlug),
    fetchPolicy: 'no-cache',
    errorPolicy: 'all',
  });
  const customers = data?.customers.edges.map((e) => ({ id: e.node.id, name: e.node.name })) ?? [];

  return (
    <>
      <h1>{t('title')}</h1>
      <p>
        <Link href={`/o/${orgSlug}/invoices/new`}>{t('new')}</Link>
      </p>
      <InvoiceFilters customers={customers} />
      {/* The URL's filters become query variables on the server; the client component keeps
          paging with the same variables. A new filter is a new URL, so a new preload. */}
      <PreloadQuery
        query={InvoicesQuery}
        variables={{ first: INVOICE_PAGE_SIZE, status, customerId }}
        context={forOrg(orgSlug)}
        errorPolicy="all"
      >
        {(queryRef) => (
          <Suspense>
            <InvoiceTable orgSlug={orgSlug} queryRef={queryRef} />
          </Suspense>
        )}
      </PreloadQuery>
    </>
  );
}
