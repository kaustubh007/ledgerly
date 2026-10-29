import { Suspense } from 'react';
import { InvoiceDetail } from '@web/features/invoices/InvoiceDetail';
import { InvoiceQuery } from '@web/graphql/documents';
import { forOrg, PreloadQuery } from '@web/lib/apollo/rsc';

/**
 * Preloaded on the server, then owned by the client: send, pay and void update the invoice in
 * Apollo's cache, and this page re-renders from there without another server round-trip.
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ orgSlug: string; invoiceId: string }>;
}) {
  const { orgSlug, invoiceId } = await params;
  return (
    <PreloadQuery
      query={InvoiceQuery}
      variables={{ id: invoiceId }}
      context={forOrg(orgSlug)}
      errorPolicy="all"
    >
      {(queryRef) => (
        <Suspense>
          <InvoiceDetail queryRef={queryRef} />
        </Suspense>
      )}
    </PreloadQuery>
  );
}
