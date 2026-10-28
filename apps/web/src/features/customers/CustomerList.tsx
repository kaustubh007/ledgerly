'use client';

import type { QueryRef } from '@apollo/client/react';
import { useQueryRefHandlers, useReadQuery } from '@apollo/client/react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import type {
  CustomersQuery as CustomersQueryResult,
  CustomersQueryVariables,
} from '@web/graphql/__generated__/graphql';
import styles from '@web/features/shell/AppShell.module.scss';

export const CUSTOMER_PAGE_SIZE = 20;

/**
 * A client component reading a query the Server Component started (<PreloadQuery>), through the
 * `queryRef` it was handed: the first page is fetched on the server with the user's cookie and
 * streamed into the browser's Apollo cache with the HTML, so there is no loading state and no
 * fetch from the browser. "Load more" then fetches further pages from the browser.
 */
export function CustomerList({
  queryRef,
}: {
  queryRef: QueryRef<CustomersQueryResult, CustomersQueryVariables>;
}) {
  const t = useTranslations('customers');
  const { data } = useReadQuery(queryRef);
  const { fetchMore } = useQueryRefHandlers(queryRef);
  const [loading, startTransition] = useTransition();
  const { edges, pageInfo } = data.customers;

  if (edges.length === 0) return <p>{t('empty')}</p>;

  function loadMore() {
    startTransition(async () => {
      await fetchMore({
        variables: { after: pageInfo.endCursor },
        updateQuery: (previous, { fetchMoreResult }) => ({
          customers: {
            ...fetchMoreResult.customers,
            edges: [...previous.customers.edges, ...fetchMoreResult.customers.edges],
          },
        }),
      });
    });
  }

  return (
    <>
      <table className={styles['table']}>
        <thead>
          <tr>
            <th scope="col">{t('name')}</th>
            <th scope="col">{t('email')}</th>
            <th scope="col">{t('currency')}</th>
          </tr>
        </thead>
        <tbody>
          {edges.map(({ node }) => (
            <tr key={node.id}>
              <td>{node.name}</td>
              <td>{node.email ?? '—'}</td>
              <td>{node.defaultCurrency}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pageInfo.hasNextPage && (
        <button type="button" onClick={loadMore} disabled={loading} aria-busy={loading}>
          {t('loadMore')}
        </button>
      )}
    </>
  );
}
