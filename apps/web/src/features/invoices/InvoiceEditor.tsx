'use client';

import { useMutation } from '@apollo/client/react';
import { supportedCurrencies } from '@ledgerly/domain';
import { CreateInvoiceInput, parseInput, type UserError } from '@ledgerly/validation';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useReducer, useState } from 'react';
import { Field, FormError, SelectField } from '@web/components/form/Field';
import styles from '@web/components/form/Form.module.scss';
import { CreateInvoiceMutation } from '@web/graphql/documents';
import { Link, useRouter } from '@web/i18n/navigation';
import { useIdempotencyKey } from '@web/lib/hooks/useIdempotencyKey';
import { useMoney } from '@web/lib/hooks/useMoney';
import { useToast } from '@web/lib/hooks/useToast';
import { initialLines, linesReducer, MAX_LINES, preview } from './lines';
import local from './Invoices.module.scss';

export interface CustomerOption {
  readonly id: string;
  readonly name: string;
  readonly defaultCurrency: string;
}

/** `['input', 'lines', '2', 'unitPrice']` → the error for that input, by path. */
function errorAt(errors: readonly UserError[], ...path: string[]): string | undefined {
  const wanted = ['input', ...path].join('.');
  return errors.find((e) => e.field.join('.') === wanted)?.code;
}

function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * A controlled form with its lines in useReducer (lines.ts). Validated with the shared zod
 * schema before sending; the server's userErrors land on the same fields by path. The
 * idempotency key lives as long as the form: a double submit creates one invoice.
 */
export function InvoiceEditor({
  orgSlug,
  customers,
}: {
  orgSlug: string;
  customers: readonly CustomerOption[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const money = useMoney();
  const [key] = useIdempotencyKey();
  const [state, dispatch] = useReducer(linesReducer, undefined, initialLines);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [currencyCode, setCurrencyCode] = useState(customers[0]?.defaultCurrency ?? 'USD');
  const [dueDate, setDueDate] = useState(() => inDays(30));
  const [errors, setErrors] = useState<readonly UserError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [create] = useMutation(CreateInvoiceMutation);
  const totalId = useId();

  // Recomputed only when lines or currency change, not on every keystroke elsewhere.
  const totals = useMemo(() => preview(state.lines, currencyCode), [state.lines, currencyCode]);

  function chooseCustomer(id: string) {
    setCustomerId(id);
    const chosen = customers.find((c) => c.id === id);
    if (chosen) setCurrencyCode(chosen.defaultCurrency);
  }

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (submitting) return;
    const input = {
      customerId,
      currency: currencyCode,
      dueDate,
      lines: state.lines.map(({ description, quantity, unitPrice }) => ({
        description,
        quantity,
        unitPrice,
      })),
    };
    const parsed = parseInput(CreateInvoiceInput, input);
    if (!parsed.ok) {
      setErrors(parsed.userErrors);
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await create({ variables: { input, key } });
      const result = data?.createInvoice;
      if (result?.invoice) {
        toast('success', t('invoices.createdDraft'));
        router.push(`/o/${orgSlug}/invoices/${result.invoice.id}`);
        return;
      }
      setErrors((result?.userErrors ?? []).map((e) => ({ ...e, field: e.field ?? [] })));
    } catch {
      setErrors([{ code: 'generic', message: '', field: [] }]);
    } finally {
      setSubmitting(false);
    }
  }

  const formLevel = errors.find((e) => e.field.length <= 1)?.code;
  return (
    <form className={styles['form']} onSubmit={(e) => void submit(e)} noValidate>
      <FormError code={formLevel}>
        {formLevel === 'PLAN_LIMIT_REACHED' && (
          <Link href={`/o/${orgSlug}/settings/billing`}>{t('billing.upgradeLink')}</Link>
        )}
      </FormError>
      <div className={styles['row']}>
        <SelectField
          label={t('invoices.customer')}
          errorCode={errorAt(errors, 'customerId')}
          value={customerId}
          onChange={(e) => chooseCustomer(e.target.value)}
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('invoices.currency')}
          errorCode={errorAt(errors, 'currency')}
          value={currencyCode}
          onChange={(e) => setCurrencyCode(e.target.value)}
        >
          {supportedCurrencies().map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </SelectField>
        <Field
          label={t('invoices.dueDate')}
          type="date"
          errorCode={errorAt(errors, 'dueDate')}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
        />
      </div>

      <fieldset className={styles['fieldset']}>
        <legend>{t('invoices.lines')}</legend>
        <div className={local['lines']}>
          {state.lines.map((line, index) => {
            const n = String(index + 1);
            const total = totals.lineTotals[index];
            return (
              <fieldset key={line.id} className={local['line']}>
                <legend className="visually-hidden">{t('invoices.lineN', { n })}</legend>
                <Field
                  label={t('invoices.description')}
                  aria-label={t('invoices.descriptionN', { n })}
                  errorCode={errorAt(errors, 'lines', String(index), 'description')}
                  value={line.description}
                  onChange={(e) =>
                    dispatch({
                      type: 'changed',
                      id: line.id,
                      field: 'description',
                      value: e.target.value,
                    })
                  }
                />
                <Field
                  label={t('invoices.quantity')}
                  aria-label={t('invoices.quantityN', { n })}
                  inputMode="decimal"
                  errorCode={
                    errorAt(errors, 'lines', String(index), 'quantity') ??
                    errorAt(errors, 'lines', String(index))
                  }
                  value={line.quantity}
                  onChange={(e) =>
                    dispatch({
                      type: 'changed',
                      id: line.id,
                      field: 'quantity',
                      value: e.target.value,
                    })
                  }
                />
                <Field
                  label={t('invoices.unitPrice')}
                  aria-label={t('invoices.unitPriceN', { n })}
                  inputMode="decimal"
                  errorCode={errorAt(errors, 'lines', String(index), 'unitPrice')}
                  value={line.unitPrice}
                  onChange={(e) =>
                    dispatch({
                      type: 'changed',
                      id: line.id,
                      field: 'unitPrice',
                      value: e.target.value,
                    })
                  }
                />
                <output className={local['lineTotal']} aria-label={t('invoices.lineTotalN', { n })}>
                  {total ? money(total.toDecimalString(), currencyCode) : '—'}
                </output>
                <div className={local['lineActions']}>
                  <button
                    type="button"
                    className={styles['secondary']}
                    aria-label={t('invoices.moveUpN', { n })}
                    disabled={index === 0}
                    onClick={() => dispatch({ type: 'moved', id: line.id, direction: -1 })}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles['secondary']}
                    aria-label={t('invoices.moveDownN', { n })}
                    disabled={index === state.lines.length - 1}
                    onClick={() => dispatch({ type: 'moved', id: line.id, direction: 1 })}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles['secondary']}
                    aria-label={t('invoices.removeN', { n })}
                    disabled={state.lines.length === 1}
                    onClick={() => dispatch({ type: 'removed', id: line.id })}
                  >
                    ✕
                  </button>
                </div>
              </fieldset>
            );
          })}
        </div>
        <div>
          <button
            type="button"
            className={styles['secondary']}
            disabled={state.lines.length >= MAX_LINES}
            onClick={() => dispatch({ type: 'added' })}
          >
            {t('invoices.addLine')}
          </button>
        </div>
      </fieldset>

      <p className={local['total']} id={totalId} aria-live="polite">
        {t('invoices.total')}:{' '}
        {totals.total ? money(totals.total.toDecimalString(), currencyCode) : '—'}
      </p>
      <button
        className={styles['submit']}
        type="submit"
        disabled={submitting}
        aria-describedby={totalId}
      >
        {submitting ? t('common.saving') : t('invoices.createDraft')}
      </button>
    </form>
  );
}
