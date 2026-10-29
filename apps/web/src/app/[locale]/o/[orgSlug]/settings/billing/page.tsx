import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { BillingPanel } from '@web/features/billing/BillingPanel';
import { BillingQuery } from '@web/graphql/documents';
import { forOrg, PreloadQuery } from '@web/lib/apollo/rsc';

export default async function BillingPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const t = await getTranslations('billing');
  return (
    <>
      <h1>{t('title')}</h1>
      <PreloadQuery query={BillingQuery} context={forOrg(orgSlug)} errorPolicy="all">
        {(queryRef) => (
          <Suspense>
            <BillingPanel queryRef={queryRef} />
          </Suspense>
        )}
      </PreloadQuery>
    </>
  );
}
