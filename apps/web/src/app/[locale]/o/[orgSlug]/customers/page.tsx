import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { CUSTOMER_PAGE_SIZE } from '@web/features/customers/constants';
import { CustomerList } from '@web/features/customers/CustomerList';
import { NewCustomer } from '@web/features/customers/NewCustomer';
import { CustomersQuery } from '@web/graphql/documents';
import { forOrg, PreloadQuery } from '@web/lib/apollo/rsc';

export default async function CustomersPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const t = await getTranslations('customers');
  return (
    <>
      <h1>{t('title')}</h1>
      <NewCustomer />
      {/* The server fetches with the user's cookie and streams the result to the browser; the
          client component reads it through the queryRef, during SSR and after hydration. */}
      <PreloadQuery
        query={CustomersQuery}
        variables={{ first: CUSTOMER_PAGE_SIZE }}
        context={forOrg(orgSlug)}
      >
        {(queryRef) => (
          <Suspense>
            <CustomerList orgSlug={orgSlug} queryRef={queryRef} />
          </Suspense>
        )}
      </PreloadQuery>
    </>
  );
}
