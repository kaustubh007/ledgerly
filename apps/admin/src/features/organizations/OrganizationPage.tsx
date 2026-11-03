import { data, useParams, type LoaderFunctionArgs } from 'react-router';
import {
  useChangeOrganizationPlanMutation,
  useMeQuery,
  useOrganizationQuery,
  useRevokeUserSessionsMutation,
  useSuspendOrganizationMutation,
  useUnsuspendOrganizationMutation,
  type OrganizationDetail,
} from '@admin/api/adminApi';
import type { AdminApiError } from '@admin/api/baseQuery';
import { loadOrganization } from '@admin/api/load';
import formStyles from '@admin/components/Form.module.scss';
import type { PlanCode } from '@admin/graphql/__generated__/graphql';
import { formatDateTime, formatMoney, t } from '@admin/i18n/t';
import { useAppDispatch } from '@admin/store/hooks';
import type { AppStore } from '@admin/store/store';
import { toastAdded } from '@admin/store/slices/toasts';
import { ActionForm, type ActionError } from './ActionForm';
import { StatusBadge } from './StatusBadge';
import styles from './Organizations.module.scss';

const PLANS: readonly PlanCode[] = ['FREE', 'PRO', 'BUSINESS'];

/** 404 for an unknown id: the route's errorElement shows it. */
export const organizationLoader =
  (store: AppStore) =>
  async ({ params }: LoaderFunctionArgs): Promise<null> => {
    const org = await loadOrganization(store, params['organizationId'] ?? '');
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router: thrown data renders the errorElement
    if (!org) throw data(t('org.notFound'), { status: 404 });
    return null;
  };

/** A thrown RTK Query error (e.g. FORBIDDEN) is toasted by the middleware; show nothing twice. */
async function run<T extends { userErrors: readonly ActionError[] }>(
  call: Promise<T>,
): Promise<{ result?: T; errors: readonly ActionError[] }> {
  try {
    const result = await call;
    return { result, errors: result.userErrors };
  } catch (error) {
    return {
      errors: [
        {
          code: (error as AdminApiError).code === 'FORBIDDEN' ? 'FORBIDDEN' : 'generic',
          field: [],
        },
      ],
    };
  }
}

function Limit({ value }: { value: number | null }) {
  return <>{value ?? t('org.unlimited')}</>;
}

function OpsActions({ org }: { org: OrganizationDetail }) {
  const dispatch = useAppDispatch();
  const [suspend] = useSuspendOrganizationMutation();
  const [unsuspend] = useUnsuspendOrganizationMutation();
  const [changePlan] = useChangeOrganizationPlanMutation();
  const suspended = org.status === 'SUSPENDED';

  return (
    <section aria-labelledby="actions" className={styles['actions']}>
      <h2 id="actions">{t('org.actions')}</h2>
      {suspended ? (
        <ActionForm
          label={t('action.unsuspend')}
          confirmLabel={t('action.unsuspendConfirm')}
          onSubmit={async ({ reason }) => {
            const { result, errors } = await run(
              unsuspend({ organizationId: org.id, reason }).unwrap(),
            );
            if (result?.organization)
              dispatch(
                toastAdded({
                  tone: 'success',
                  message: t('toast.unsuspended', { name: org.name }),
                }),
              );
            return errors;
          }}
        />
      ) : (
        <ActionForm
          label={t('action.suspend')}
          confirmLabel={t('action.suspendConfirm')}
          tone="danger"
          onSubmit={async ({ reason }) => {
            const { result, errors } = await run(
              suspend({ organizationId: org.id, reason }).unwrap(),
            );
            if (result?.organization)
              dispatch(
                toastAdded({ tone: 'success', message: t('toast.suspended', { name: org.name }) }),
              );
            return errors;
          }}
        />
      )}
      <ActionForm
        label={t('action.changePlan')}
        confirmLabel={t('action.changePlanConfirm')}
        onSubmit={async ({ reason, form }) => {
          const plan = form.get('plan') as PlanCode;
          const { result, errors } = await run(
            changePlan({ organizationId: org.id, plan, reason }).unwrap(),
          );
          if (result?.organization) {
            dispatch(
              toastAdded({
                tone: 'success',
                message: t('toast.planChanged', { name: org.name, plan }),
              }),
            );
          }
          return errors;
        }}
      >
        <div className={formStyles['field']}>
          <label htmlFor="plan">{t('action.newPlan')}</label>
          <select id="plan" name="plan" defaultValue={PLANS.find((p) => p !== org.plan)}>
            {PLANS.filter((p) => p !== org.plan).map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
        </div>
      </ActionForm>
    </section>
  );
}

export function OrganizationPage() {
  const id = useParams()['organizationId'] ?? '';
  const { data: org } = useOrganizationQuery(id);
  const { data: me } = useMeQuery();
  const [revoke] = useRevokeUserSessionsMutation();
  const dispatch = useAppDispatch();
  const ops = me?.role === 'OPS';
  if (!org) return null; // the loader guarantees it on first render; null only after a reset

  return (
    <div className={styles['sections']}>
      <div>
        <h1>
          {org.name} <StatusBadge status={org.status} />
        </h1>
        <dl className={styles['summary']}>
          <dt>{t('org.slug')}</dt>
          <dd>{org.slug}</dd>
          <dt>{t('orgs.plan')}</dt>
          <dd>{org.plan}</dd>
          <dt>{t('orgs.created')}</dt>
          <dd>{formatDateTime(org.createdAt)}</dd>
          {org.suspendedAt && (
            <>
              <dt>{t('org.suspendedAt')}</dt>
              <dd>{formatDateTime(org.suspendedAt)}</dd>
            </>
          )}
        </dl>
      </div>

      {ops ? <OpsActions org={org} /> : <p>{t('org.opsOnly')}</p>}

      <section aria-labelledby="usage">
        <h2 id="usage">{t('org.usage')}</h2>
        <table className={styles['table']} aria-labelledby="usage">
          <thead>
            <tr>
              <th scope="col">{t('org.resource')}</th>
              <th scope="col">{t('org.used')}</th>
              <th scope="col">{t('org.limit')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{t('org.customers')}</th>
              <td data-numeric>{org.usage.customers}</td>
              <td data-numeric>
                <Limit value={org.usage.customersLimit} />
              </td>
            </tr>
            <tr>
              <th scope="row">{t('org.invoicesThisMonth')}</th>
              <td data-numeric>{org.usage.invoicesThisMonth}</td>
              <td data-numeric>
                <Limit value={org.usage.invoicesPerMonthLimit} />
              </td>
            </tr>
            <tr>
              <th scope="row">{t('org.seats')}</th>
              <td data-numeric>{org.usage.seats}</td>
              <td data-numeric>
                <Limit value={org.usage.seatsLimit} />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section aria-labelledby="outstanding">
        <h2 id="outstanding">{t('org.outstanding')}</h2>
        {org.outstanding.length === 0 ? (
          <p>{t('org.noOutstanding')}</p>
        ) : (
          <table className={styles['table']} aria-labelledby="outstanding">
            <thead>
              <tr>
                <th scope="col">{t('org.currency')}</th>
                <th scope="col">{t('org.amount')}</th>
                <th scope="col">{t('org.invoices')}</th>
              </tr>
            </thead>
            <tbody>
              {org.outstanding.map((row) => (
                <tr key={row.currency}>
                  <th scope="row">{row.currency}</th>
                  <td data-numeric>{formatMoney(row.amount.amount, row.amount.currency)}</td>
                  <td data-numeric>{row.invoices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="health">
        <h2 id="health">{t('org.health')}</h2>
        <dl className={styles['summary']}>
          <dt>{t('org.lastActive')}</dt>
          <dd>
            {org.health.lastActiveAt ? formatDateTime(org.health.lastActiveAt) : t('org.never')}
          </dd>
          <dt>{t('org.overdue')}</dt>
          <dd>{org.health.overdueInvoices}</dd>
        </dl>
      </section>

      <section aria-labelledby="members">
        <h2 id="members">{t('org.membersTitle')}</h2>
        <table className={styles['table']} aria-labelledby="members">
          <thead>
            <tr>
              <th scope="col">{t('orgs.name')}</th>
              <th scope="col">{t('org.email')}</th>
              <th scope="col">{t('org.role')}</th>
              <th scope="col">{t('org.sessions')}</th>
              {ops && <th scope="col">{t('org.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {org.members.map((member) => (
              <tr key={member.userId}>
                <td>{member.name}</td>
                <td>{member.email}</td>
                <td>{member.role}</td>
                <td data-numeric>{member.activeSessions}</td>
                {ops && (
                  <td>
                    <ActionForm
                      label={
                        <>
                          {t('action.revoke')}
                          <span className="visually-hidden"> ({member.name})</span>
                        </>
                      }
                      confirmLabel={t('action.revokeConfirm')}
                      tone="danger"
                      onSubmit={async ({ reason }) => {
                        const { result, errors } = await run(
                          revoke({
                            organizationId: org.id,
                            userId: member.userId,
                            reason,
                          }).unwrap(),
                        );
                        if (result && errors.length === 0) {
                          dispatch(
                            toastAdded({
                              tone: 'success',
                              message: t('toast.revoked', { count: result.revoked }),
                            }),
                          );
                        }
                        return errors;
                      }}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
