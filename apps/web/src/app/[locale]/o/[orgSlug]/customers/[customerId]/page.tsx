import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CustomerForm } from '@web/features/customers/CustomerForm';
import { CustomerQuery } from '@web/graphql/documents';
import { Link } from '@web/i18n/navigation';
import { forOrg, query } from '@web/lib/apollo/rsc';

/**
 * Data from a Server Component handed to a client component as props: the simplest way, fine
 * when the client does not need Apollo to keep the data live (the form owns it once loaded).
 */
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ orgSlug: string; customerId: string }>;
}) {
  const { orgSlug, customerId } = await params;
  const t = await getTranslations('customers');
  const { data } = await query({
    query: CustomerQuery,
    variables: { id: customerId },
    context: forOrg(orgSlug),
    fetchPolicy: 'no-cache',
    errorPolicy: 'all',
  });
  const customer = data?.customer;
  if (!customer) notFound();
  return (
    <>
      <h1>{customer.name}</h1>
      <p>
        <Link href={`/o/${orgSlug}/invoices?customer=${customer.id}`}>
          {t('invoicesOf', { name: customer.name })}
        </Link>
      </p>
      <h2>{t('edit')}</h2>
      <CustomerForm customer={customer} />
    </>
  );
}
