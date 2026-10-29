import { getTranslations } from 'next-intl/server';
import { InvoiceEditor } from '@web/features/invoices/InvoiceEditor';
import { CustomerOptionsQuery } from '@web/graphql/documents';
import { Link } from '@web/i18n/navigation';
import { forOrg, query } from '@web/lib/apollo/rsc';

export default async function NewInvoicePage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const t = await getTranslations('invoices');
  const { data } = await query({
    query: CustomerOptionsQuery,
    context: forOrg(orgSlug),
    fetchPolicy: 'no-cache',
    errorPolicy: 'all',
  });
  const customers = data?.customers.edges.map((e) => e.node) ?? [];
  return (
    <>
      <h1>{t('new')}</h1>
      {customers.length === 0 ? (
        <p>
          {t('needCustomer')} <Link href={`/o/${orgSlug}/customers`}>{t('addCustomerFirst')}</Link>
        </p>
      ) : (
        <InvoiceEditor orgSlug={orgSlug} customers={customers} />
      )}
    </>
  );
}
