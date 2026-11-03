import { Form, Link, useSearchParams, type LoaderFunctionArgs } from 'react-router';
import { useAuditLogQuery } from '@admin/api/adminApi';
import { loadAuditLog } from '@admin/api/load';
import formStyles from '@admin/components/Form.module.scss';
import { formatDateTime, t } from '@admin/i18n/t';
import type { AppStore } from '@admin/store/store';
import styles from '../organizations/Organizations.module.scss';
import { param } from '../organizations/params';

export const AUDIT_ACTIONS = [
  'organization.suspend',
  'organization.unsuspend',
  'organization.changePlan',
  'user.revokeSessions',
  'organization.view',
  'organization.search',
  'audit.view',
  'staff.signIn',
  'staff.signIn.failed',
  'staff.mfa.failed',
  'staff.mfa.enrolled',
  'staff.signOut',
] as const;

function auditArgs(params: URLSearchParams) {
  const organizationId = params.get('organizationId') ?? '';
  const action = params.get('action') ?? '';
  return {
    filter: {
      ...(/^[a-f\d]{24}$/.test(organizationId) ? { organizationId } : {}),
      ...(action ? { action } : {}),
    },
    after: param(params, 'after'),
    first: 50,
  };
}

export const auditLogLoader =
  (store: AppStore) =>
  async ({ request }: LoaderFunctionArgs): Promise<null> => {
    await loadAuditLog(store, auditArgs(new URL(request.url).searchParams));
    return null;
  };

/** Lazy route: the code for this page loads only when someone opens it. */
export function AuditLogPage() {
  const [params] = useSearchParams();
  const args = auditArgs(params);
  const { data } = useAuditLogQuery(args);
  const nextParams = new URLSearchParams(params);
  if (data?.pageInfo.endCursor) nextParams.set('after', data.pageInfo.endCursor);

  return (
    <>
      <h1>{t('audit.title')}</h1>
      <search>
        <Form method="get" className={styles['filters']}>
          <div className={formStyles['field']}>
            <label htmlFor="organizationId">{t('audit.organizationId')}</label>
            <input
              id="organizationId"
              name="organizationId"
              defaultValue={args.filter.organizationId ?? ''}
            />
          </div>
          <div className={formStyles['field']}>
            <label htmlFor="action">{t('audit.action')}</label>
            <select id="action" name="action" defaultValue={args.filter.action ?? ''}>
              <option value="">{t('audit.anyAction')}</option>
              {AUDIT_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
          <button className={formStyles['button']} type="submit">
            {t('orgs.apply')}
          </button>
        </Form>
      </search>
      {data?.edges.length === 0 ? (
        <p>{t('audit.empty')}</p>
      ) : (
        <table className={styles['table']}>
          <caption className="visually-hidden">{t('audit.title')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('audit.at')}</th>
              <th scope="col">{t('audit.staff')}</th>
              <th scope="col">{t('audit.action')}</th>
              <th scope="col">{t('audit.organization')}</th>
              <th scope="col">{t('audit.reason')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.edges.map(({ node }) => (
              <tr key={node.id}>
                <td>{formatDateTime(node.at)}</td>
                <td>{node.staff?.email ?? t('audit.system')}</td>
                <td>
                  <code>{node.action}</code>
                </td>
                <td>
                  {node.organizationId ? (
                    <Link to={`/organizations/${node.organizationId}`}>
                      {node.organizationName ?? node.organizationId}
                    </Link>
                  ) : null}
                </td>
                <td>{node.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data?.pageInfo.hasNextPage && (
        <p>
          <Link to={`?${nextParams.toString()}`}>{t('orgs.next')}</Link>
        </p>
      )}
    </>
  );
}
