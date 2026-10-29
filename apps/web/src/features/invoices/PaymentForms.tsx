'use client';

import { useMutation } from '@apollo/client/react';
import { MoneyInput, parseInput, type UserError } from '@ledgerly/validation';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Field, FormError, SelectField } from '@web/components/form/Field';
import { formText } from '@web/components/form/formData';
import styles from '@web/components/form/Form.module.scss';
import { PayInvoiceByCardMutation, RecordPaymentMutation } from '@web/graphql/documents';
import { useIdempotencyKey } from '@web/lib/hooks/useIdempotencyKey';
import { useMoney } from '@web/lib/hooks/useMoney';
import { useToast } from '@web/lib/hooks/useToast';
import { TEST_CARDS } from './constants';

interface FormState {
  readonly errors: readonly UserError[];
}

const errorFor = (errors: readonly UserError[], last: string) =>
  errors.find(
    (e) => e.field.at(-1) === last || (last === 'amount' && e.field.join('.') === 'input.amount'),
  )?.code;

export interface PaymentFormProps {
  readonly invoiceId: string;
  readonly currency: string;
  readonly balance: string;
  /** Shows the payment in the list before the server confirms it (useOptimistic, in the parent). */
  readonly addOptimistic: (amount: string, method: 'MANUAL' | 'CARD') => void;
}

/**
 * React 19 form actions. `useActionState` runs the action in a transition, gives back its result
 * (our errors) and a pending flag, and queues repeated submits instead of overlapping them; the
 * idempotency key, kept until success, makes even a replayed submit record one payment. Fields
 * are uncontrolled: React resets the form after a successful action.
 */
function usePaymentAction(
  props: PaymentFormProps,
  method: 'MANUAL' | 'CARD',
  send: (
    amount: string,
    formData: FormData,
    key: string,
  ) => Promise<readonly UserError[] | undefined>,
) {
  const t = useTranslations('invoices');
  const toast = useToast();
  const money = useMoney();
  const [key, renew] = useIdempotencyKey();
  return useActionState<FormState, FormData>(
    async (_previous, formData) => {
      const amount = formText(formData, 'amount');
      const parsed = parseInput(MoneyInput, { amount, currency: props.currency }, [
        'input',
        'amount',
      ]);
      if (!parsed.ok) return { errors: parsed.userErrors };
      props.addOptimistic(amount, method);
      try {
        const errors = (await send(amount, formData, key)) ?? [];
        if (errors.length > 0) return { errors };
      } catch {
        return { errors: [{ code: 'generic', message: '', field: [] }] };
      }
      renew();
      toast('success', t('paymentRecorded', { amount: money(amount, props.currency) }));
      return { errors: [] };
    },
    { errors: [] },
  );
}

export function RecordPaymentForm(props: PaymentFormProps) {
  const t = useTranslations('invoices');
  const [record] = useMutation(RecordPaymentMutation);
  const [state, action, pending] = usePaymentAction(
    props,
    'MANUAL',
    async (amount, _formData, key) => {
      const { data } = await record({
        variables: {
          key,
          input: { invoiceId: props.invoiceId, amount: { amount, currency: props.currency } },
        },
      });
      return data?.recordPayment.userErrors.map((e) => ({ ...e, field: e.field ?? [] }));
    },
  );
  const formError = state.errors.find((e) => e.field.length === 0)?.code;
  return (
    <form action={action} className={styles['form']} aria-label={t('recordPayment')} noValidate>
      <h3>{t('recordPayment')}</h3>
      <FormError code={formError} />
      <Field
        label={t('amount', { currency: props.currency })}
        name="amount"
        inputMode="decimal"
        defaultValue={props.balance}
        errorCode={errorFor(state.errors, 'amount')}
      />
      <button className={styles['submit']} type="submit" disabled={pending}>
        {pending ? t('recording') : t('recordPayment')}
      </button>
    </form>
  );
}

export function CardPaymentForm(props: PaymentFormProps) {
  const t = useTranslations('invoices');
  const [pay] = useMutation(PayInvoiceByCardMutation);
  const [state, action, pending] = usePaymentAction(
    props,
    'CARD',
    async (amount, formData, key) => {
      const paymentMethod = formText(formData, 'paymentMethod');
      const { data } = await pay({
        variables: {
          key,
          input: {
            invoiceId: props.invoiceId,
            paymentMethod,
            amount: { amount, currency: props.currency },
          },
        },
      });
      return data?.payInvoiceByCard.userErrors.map((e) => ({ ...e, field: e.field ?? [] }));
    },
  );
  const formError = state.errors.find((e) => e.field.length === 0)?.code;
  return (
    <form action={action} className={styles['form']} aria-label={t('payByCard')} noValidate>
      <h3>{t('payByCard')}</h3>
      <FormError code={formError} />
      <Field
        label={t('amount', { currency: props.currency })}
        name="amount"
        inputMode="decimal"
        defaultValue={props.balance}
        errorCode={errorFor(state.errors, 'amount')}
      />
      <SelectField
        label={t('testCard')}
        hint={t('testCardHint')}
        name="paymentMethod"
        errorCode={errorFor(state.errors, 'paymentMethod')}
        defaultValue="pm_card_visa"
      >
        {TEST_CARDS.map((card) => (
          <option key={card} value={card}>
            {t(`cards.${card}`)}
          </option>
        ))}
      </SelectField>
      <button className={styles['submit']} type="submit" disabled={pending}>
        {pending ? t('charging') : t('payByCard')}
      </button>
    </form>
  );
}
