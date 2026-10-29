'use client';

import type { QueryRef } from '@apollo/client/react';
import { useQueryRefHandlers, useReadQuery } from '@apollo/client/react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import type { InvoicesQuery, InvoicesQueryVariables } from '@web/graphql/__generated__/graphql';
import { Link } from '@web/i18n/navigation';
import { useMoney } from '@web/lib/hooks/useMoney';
import shell from '@web/features/shell/AppShell.module.scss';
import { StatusBadge } from './StatusBadge';

export function InvoiceTable({
  orgSlug,
  queryRef,
}: {
  orgSlug: string;
  queryRef: QueryRef<InvoicesQuery, InvoicesQueryVariables>;
}) {
  const t = useTranslations('invoices');
  const money = useMoney();
  const { data } = useReadQuery(queryRef);
  const { fetchMore } = useQueryRefHandlers(queryRef);
  const [loading, startTransition] = useTransition();
  const { edges, pageInfo } = data.invoices;

  if (edges.length === 0) return <p>{t('empty')}</p>;

  return (
    <>
      <table className={shell['table']}>
        <thead>
          <tr>
            <th scope="col">{t('number')}</th>
            <th scope="col">{t('customer')}</th>
            <th scope="col">{t('statusColumn')}</th>
            <th scope="col">{t('dueDate')}</th>
            <th scope="col">{t('total')}</th>
            <th scope="col">{t('balance')}</th>
          </tr>
        </thead>
        <tbody>
          {edges.map(({ node }) => (
            <tr key={node.id}>
              <th scope="row">
                <Link href={`/o/${orgSlug}/invoices/${node.id}`}>{node.number ?? t('draft')}</Link>
              </th>
              <td>{node.customer.name}</td>
              <td>
                <StatusBadge status={node.status} overdue={node.overdue} />
              </td>
              <td>{node.dueDate}</td>
              <td data-numeric>{money(node.total.amount, node.currency)}</td>
              <td data-numeric>{money(node.balance.amount, node.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pageInfo.hasNextPage && (
        <button
          type="button"
          disabled={loading}
          aria-busy={loading}
          onClick={() =>
            startTransition(async () => {
              await fetchMore({
                variables: { after: pageInfo.endCursor },
                updateQuery: (previous, { fetchMoreResult }) => ({
                  invoices: {
                    ...fetchMoreResult.invoices,
                    edges: [...previous.invoices.edges, ...fetchMoreResult.invoices.edges],
                  },
                }),
              });
            })
          }
        >
          {t('loadMore')}
        </button>
      )}
    </>
  );
}
