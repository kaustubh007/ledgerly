'use client';

import type { QueryRef } from '@apollo/client/react';
import { useReadQuery } from '@apollo/client/react';
import { canPerform } from '@ledgerly/domain';
import { useFormatter, useTranslations } from 'next-intl';
import { useOptimistic } from 'react';
import type { InvoiceQuery, InvoiceQueryVariables } from '@web/graphql/__generated__/graphql';
import { useMoney } from '@web/lib/hooks/useMoney';
import { usePermission } from '@web/lib/hooks/usePermission';
import shell from '@web/features/shell/AppShell.module.scss';
import { InvoiceActions } from './InvoiceActions';
import { CardPaymentForm, RecordPaymentForm } from './PaymentForms';
import { StatusBadge } from './StatusBadge';
import local from './Invoices.module.scss';

type PaymentRow = NonNullable<InvoiceQuery['invoice']>['payments'][number] & {
  readonly pending?: boolean;
};

export function InvoiceDetail({
  queryRef,
}: {
  queryRef: QueryRef<InvoiceQuery, InvoiceQueryVariables>;
}) {
  const t = useTranslations('invoices');
  const format = useFormatter();
  const money = useMoney();
  const { data } = useReadQuery(queryRef);
  const invoice = data.invoice;
  const canRecord = usePermission('payments:record');

  // The payments list as the user should see it *right now*: the server's list, plus a payment
  // being submitted. When the submit settles, React drops the optimistic row and the real list
  // (already updated in Apollo's cache by the mutation result) takes its place; on failure the
  // row simply disappears and the form shows why.
  const [payments, addOptimistic] = useOptimistic<
    readonly PaymentRow[],
    { amount: string; method: 'MANUAL' | 'CARD' }
  >(invoice?.payments ?? [], (current, next) => [
    ...current,
    {
      __typename: 'Payment',
      id: 'pending',
      method: next.method,
      reference: null,
      recordedAt: new Date().toISOString(),
      amount: { __typename: 'Money', amount: next.amount },
      pending: true,
    },
  ]);

  if (!invoice) {
    return <h1>{t('notFound')}</h1>;
  }

  const title = invoice.number ?? t('draft');
  const payable = canRecord && canPerform(invoice.status, 'RECORD_PAYMENT');
  const paymentProps = {
    invoiceId: invoice.id,
    currency: invoice.currency,
    balance: invoice.balance.amount,
    addOptimistic: (amount: string, method: 'MANUAL' | 'CARD') => addOptimistic({ amount, method }),
  };

  return (
    <>
      <h1>
        {t('invoiceTitle', { number: title })}{' '}
        <StatusBadge status={invoice.status} overdue={invoice.overdue} />
      </h1>
      <dl className={local['summary']}>
        <dt>{t('customer')}</dt>
        <dd>{invoice.customer.name}</dd>
        <dt>{t('dueDate')}</dt>
        <dd>
          {format.dateTime(new Date(`${invoice.dueDate}T00:00:00Z`), {
            dateStyle: 'long',
            timeZone: 'UTC',
          })}
        </dd>
        <dt>{t('total')}</dt>
        <dd>{money(invoice.total.amount, invoice.currency)}</dd>
        <dt>{t('paid')}</dt>
        <dd>{money(invoice.paid.amount, invoice.currency)}</dd>
        <dt>{t('balance')}</dt>
        <dd>{money(invoice.balance.amount, invoice.currency)}</dd>
      </dl>

      <InvoiceActions id={invoice.id} status={invoice.status} />

      <table className={shell['table']}>
        <caption>{t('lines')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('description')}</th>
            <th scope="col">{t('quantity')}</th>
            <th scope="col">{t('unitPrice')}</th>
            <th scope="col">{t('total')}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, i) => (
            <tr key={`${String(i)}-${line.description}`}>
              <td>{line.description}</td>
              <td data-numeric>{line.quantity}</td>
              <td data-numeric>{money(line.unitPrice.amount, invoice.currency)}</td>
              <td data-numeric>{money(line.total.amount, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{t('payments')}</h2>
      {payments.length === 0 ? (
        <p>{t('noPayments')}</p>
      ) : (
        <table className={shell['table']}>
          <thead>
            <tr>
              <th scope="col">{t('recordedAt')}</th>
              <th scope="col">{t('method')}</th>
              <th scope="col">{t('amountColumn')}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr
                key={p.id}
                className={p.pending ? local['pending'] : undefined}
                aria-busy={p.pending ? true : undefined}
              >
                <td>
                  {p.pending
                    ? t('pendingPayment')
                    : format.dateTime(new Date(p.recordedAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                </td>
                <td>
                  {t(`methods.${p.method}`)}
                  {p.reference && <span className="visually-hidden"> {p.reference}</span>}
                </td>
                <td data-numeric>{money(p.amount.amount, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {payable && (
        <div className={local['columns']}>
          {/* Keyed by the balance: when it changes, the forms remount and their (uncontrolled)
              amount fields default to the new balance. defaultValue alone applies only once. */}
          <RecordPaymentForm key={`manual-${invoice.balance.amount}`} {...paymentProps} />
          <CardPaymentForm key={`card-${invoice.balance.amount}`} {...paymentProps} />
        </div>
      )}
    </>
  );
}
