'use client';

import type { QueryRef } from '@apollo/client/react';
import { useMutation, useReadQuery } from '@apollo/client/react';
import { overLimitAfterChange, planChange, type PlanCode } from '@ledgerly/domain';
import { useTranslations } from 'next-intl';
import { useActionState, useId, useState } from 'react';
import { FormError, SelectField } from '@web/components/form/Field';
import { formText } from '@web/components/form/formData';
import formStyles from '@web/components/form/Form.module.scss';
import { TEST_CARDS } from '@web/features/invoices/constants';
import type { BillingQuery, BillingQueryVariables } from '@web/graphql/__generated__/graphql';
import { ChangePlanMutation } from '@web/graphql/documents';
import { useIdempotencyKey } from '@web/lib/hooks/useIdempotencyKey';
import { useMoney } from '@web/lib/hooks/useMoney';
import { usePermission } from '@web/lib/hooks/usePermission';
import { useToast } from '@web/lib/hooks/useToast';
import styles from './Billing.module.scss';

type Resource = 'customers' | 'invoicesPerMonth' | 'seats';

export function BillingPanel({
  queryRef,
}: {
  queryRef: QueryRef<BillingQuery, BillingQueryVariables>;
}) {
  const t = useTranslations('billing');
  const money = useMoney();
  const { data } = useReadQuery(queryRef);
  const canManage = usePermission('organization:manage');
  const org = data.organization;
  if (!org) return null;

  const current = data.plans.find((p) => p.code === org.plan.code);
  const used: Record<Resource, number> = {
    customers: org.usage.customers,
    invoicesPerMonth: org.usage.invoicesThisMonth,
    seats: org.usage.seats,
  };

  return (
    <>
      <section aria-labelledby="usage-heading">
        <h2 id="usage-heading">{t('currentPlan', { plan: t(`plans.${org.plan.code}`) })}</h2>
        <ul className={styles['meters']}>
          {(['customers', 'invoicesPerMonth', 'seats'] as const).map((resource) => (
            <UsageMeter
              key={resource}
              resource={resource}
              used={used[resource]}
              limit={current?.limits[resource] ?? null}
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby="plans-heading">
        <h2 id="plans-heading">{t('plansTitle')}</h2>
        <ul className={styles['plans']}>
          {data.plans.map((plan) => (
            <li
              key={plan.code}
              className={styles['plan']}
              aria-current={plan.code === org.plan.code ? 'true' : undefined}
            >
              <h3>{t(`plans.${plan.code}`)}</h3>
              <p className={styles['price']}>
                {t('perMonth', {
                  price: money(plan.monthlyPrice.amount, plan.monthlyPrice.currency),
                })}
              </p>
              <ul>
                {(['customers', 'invoicesPerMonth', 'seats'] as const).map((resource) => (
                  <li key={resource}>
                    {t(`limits.${resource}`, { limit: plan.limits[resource] ?? -1 })}
                  </li>
                ))}
                {(['customBranding', 'mfaEnforcement', 'auditExport'] as const)
                  .filter((feature) => plan.features[feature])
                  .map((feature) => (
                    <li key={feature}>{t(`features.${feature}`)}</li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
        {canManage ? (
          <ChangePlanForm current={org.plan.code} usage={used} />
        ) : (
          <p>{t('ownerOnly')}</p>
        )}
      </section>
    </>
  );
}

function UsageMeter({
  resource,
  used,
  limit,
}: {
  resource: Resource;
  used: number;
  limit: number | null;
}) {
  const t = useTranslations('billing');
  const id = useId();
  return (
    <li>
      <label htmlFor={id}>{t(`usage.${resource}`, { used, limit: limit ?? -1 })}</label>
      {limit !== null && (
        // <meter> is the native "a value within a known range" element; low/high/optimum let
        // browsers colour it as it nears the limit.
        <meter
          id={id}
          min={0}
          max={limit}
          value={Math.min(used, limit)}
          low={limit * 0.7}
          high={limit * 0.9}
          optimum={0}
        />
      )}
    </li>
  );
}

function ChangePlanForm({
  current,
  usage,
}: {
  current: PlanCode;
  usage: Record<Resource, number>;
}) {
  const t = useTranslations('billing');
  const toast = useToast();
  const [key, renew] = useIdempotencyKey();
  const [target, setTarget] = useState<PlanCode>(
    current === 'BUSINESS' ? 'PRO' : current === 'PRO' ? 'BUSINESS' : 'PRO',
  );
  const [change] = useMutation(ChangePlanMutation);
  const kind = planChange(current, target);
  const overLimit = kind === 'DOWNGRADE' ? overLimitAfterChange(target, usage) : [];

  const [state, action, pending] = useActionState<{ error?: string }, FormData>(
    async (_previous, formData) => {
      const paymentMethod = kind === 'UPGRADE' ? formText(formData, 'paymentMethod') : null;
      try {
        const { data } = await change({
          variables: { key, input: { plan: target, paymentMethod } },
        });
        const error = data?.changePlan.userErrors[0]?.code;
        if (error) return { error };
      } catch {
        return { error: 'generic' };
      }
      renew();
      toast('success', t('changed', { plan: t(`plans.${target}`) }));
      return {};
    },
    {},
  );

  return (
    <form action={action} className={formStyles['form']} aria-labelledby="change-plan-heading">
      <h3 id="change-plan-heading">{t('changePlan')}</h3>
      <FormError code={state.error} />
      <SelectField
        label={t('newPlan')}
        errorCode={undefined}
        value={target}
        onChange={(e) => setTarget(e.target.value as PlanCode)}
      >
        {(['FREE', 'PRO', 'BUSINESS'] as const)
          .filter((code) => code !== current)
          .map((code) => (
            <option key={code} value={code}>
              {t(`plans.${code}`)}
            </option>
          ))}
      </SelectField>
      {kind === 'UPGRADE' && (
        <SelectField
          label={t('testCard')}
          hint={t('testCardHint')}
          name="paymentMethod"
          errorCode={undefined}
          defaultValue="pm_card_visa"
        >
          {TEST_CARDS.map((card) => (
            <option key={card} value={card}>
              {card}
            </option>
          ))}
        </SelectField>
      )}
      {overLimit.length > 0 && (
        <p role="note" className={styles['warning']}>
          {t('downgradeWarning', {
            resources: overLimit.map((r) => t(`resources.${r}`)).join(', '),
          })}
        </p>
      )}
      <button className={formStyles['submit']} type="submit" disabled={pending}>
        {pending
          ? t('changing')
          : t(kind === 'UPGRADE' ? 'upgrade' : 'downgrade', { plan: t(`plans.${target}`) })}
      </button>
    </form>
  );
}
