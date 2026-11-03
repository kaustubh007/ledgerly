import { Form, Link, useSearchParams, type LoaderFunctionArgs } from 'react-router';
import { useOrganizationsQuery } from '@admin/api/adminApi';
import { loadOrganizations } from '@admin/api/load';
import formStyles from '@admin/components/Form.module.scss';
import { formatDateTime, t } from '@admin/i18n/t';
import type { AppStore } from '@admin/store/store';
import { listArgs } from './params';
import { StatusBadge } from './StatusBadge';
import styles from './Organizations.module.scss';

/** Prefetch the page's query from the URL before rendering it. */
export const organizationsLoader =
  (store: AppStore) =>
  async ({ request }: LoaderFunctionArgs): Promise<null> => {
    await loadOrganizations(store, listArgs(new URL(request.url).searchParams));
    return null;
  };

export function OrganizationsPage() {
  const [params] = useSearchParams();
  const args = listArgs(params);
  const { data, isFetching } = useOrganizationsQuery(args);
  const nextParams = new URLSearchParams(params);
  if (data?.pageInfo.endCursor) nextParams.set('after', data.pageInfo.endCursor);
  const firstParams = new URLSearchParams(params);
  firstParams.delete('after');

  return (
    <>
      <h1>{t('orgs.title')}</h1>
      {/* GET: submitting rewrites the URL's search params, which re-runs the loader. */}
      <search>
        <Form method="get" className={styles['filters']}>
          <div className={formStyles['field']}>
            <label htmlFor="q">{t('orgs.search')}</label>
            <input id="q" name="q" type="search" defaultValue={args.search ?? ''} />
          </div>
          <div className={formStyles['field']}>
            <label htmlFor="status">{t('orgs.status')}</label>
            <select id="status" name="status" defaultValue={args.status ?? ''}>
              <option value="">{t('orgs.anyStatus')}</option>
              <option value="ACTIVE">{t('status.ACTIVE')}</option>
              <option value="SUSPENDED">{t('status.SUSPENDED')}</option>
            </select>
          </div>
          <button className={formStyles['button']} type="submit">
            {t('orgs.apply')}
          </button>
        </Form>
      </search>

      {data?.edges.length === 0 ? (
        <p>{t('orgs.empty')}</p>
      ) : (
        <table className={styles['table']} aria-busy={isFetching}>
          <caption className="visually-hidden">{t('orgs.title')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('orgs.name')}</th>
              <th scope="col">{t('orgs.status')}</th>
              <th scope="col">{t('orgs.plan')}</th>
              <th scope="col">{t('orgs.members')}</th>
              <th scope="col">{t('orgs.created')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.edges.map(({ node }) => (
              <tr key={node.id}>
                <td>
                  <Link to={`/organizations/${node.id}`}>{node.name}</Link>
                  <div className={styles['muted']}>{node.slug}</div>
                </td>
                <td>
                  <StatusBadge status={node.status} />
                </td>
                <td>{node.plan}</td>
                <td data-numeric>{node.memberCount}</td>
                <td>{formatDateTime(node.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className={styles['pager']}>
        {args.after && <Link to={`?${firstParams.toString()}`}>{t('orgs.first')}</Link>}
        {data?.pageInfo.hasNextPage && (
          <Link to={`?${nextParams.toString()}`}>{t('orgs.next')}</Link>
        )}
      </p>
    </>
  );
}
