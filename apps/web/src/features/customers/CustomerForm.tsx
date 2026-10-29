'use client';

import { useMutation } from '@apollo/client/react';
import { supportedCurrencies } from '@ledgerly/domain';
import { CustomerInput } from '@ledgerly/validation';
import { useTranslations } from 'next-intl';
import { Field, FormError, SelectField, TextAreaField } from '@web/components/form/Field';
import { fieldErrorCode } from '@web/components/form/errors';
import styles from '@web/components/form/Form.module.scss';
import { useZodForm } from '@web/components/form/useZodForm';
import type { CustomerFieldsFragment } from '@web/graphql/__generated__/graphql';
import {
  CreateCustomerMutation,
  CustomersQuery,
  UpdateCustomerMutation,
} from '@web/graphql/documents';
import { CUSTOMER_PAGE_SIZE, DOCUMENT_LOCALES } from './constants';
import { Link } from '@web/i18n/navigation';
import { useToast } from '@web/lib/hooks/useToast';
import { useAppSelector } from '@web/store/hooks';
import { selectActiveOrg } from '@web/store/slices/session';

/** Optional text inputs: an empty box means "none", which the API spells `null`. */
const emptyToNull = (value: unknown) => (value === '' ? null : value);

/**
 * Create (no `customer`) or edit. Same zod schema as the API. On create, the new customer is
 * written into Apollo's cached customer list (cache.updateQuery), so the list on the same page
 * shows it at once without refetching.
 */
export function CustomerForm({
  customer,
  onDone,
}: {
  customer?: CustomerFieldsFragment;
  onDone?: () => void;
}) {
  const t = useTranslations();
  const toast = useToast();
  const org = useAppSelector(selectActiveOrg);
  const form = useZodForm(CustomerInput, {
    name: customer?.name ?? '',
    email: customer?.email ?? null,
    defaultCurrency: customer?.defaultCurrency ?? 'USD',
    documentLocale: customer?.documentLocale ?? 'en-US',
    billingAddress: customer?.billingAddress ?? null,
  });
  const { errors, isSubmitting } = form.formState;

  const [create] = useMutation(CreateCustomerMutation, {
    // Put the new customer at the top of the cached list the page shows (the exact query and
    // variables CustomerList read), so it appears without a refetch.
    update(cache, { data }) {
      const created = data?.createCustomer.customer;
      if (!created) return;
      cache.updateQuery(
        { query: CustomersQuery, variables: { first: CUSTOMER_PAGE_SIZE } },
        (list) =>
          list
            ? {
                customers: {
                  ...list.customers,
                  edges: [
                    { __typename: 'CustomerEdge', cursor: '', node: created },
                    ...list.customers.edges,
                  ],
                },
              }
            : list,
      );
    },
  });
  const [update] = useMutation(UpdateCustomerMutation);

  const onSubmit = form.handleSubmit(async (input) => {
    const variables = {
      input: { ...input, email: input.email ?? null, billingAddress: input.billingAddress ?? null },
    };
    try {
      const payload = customer
        ? (await update({ variables: { id: customer.id, ...variables } })).data?.updateCustomer
        : (await create({ variables })).data?.createCustomer;
      if (payload?.customer) {
        toast(
          'success',
          t(customer ? 'customers.updated' : 'customers.created', { name: payload.customer.name }),
        );
        if (!customer) form.reset();
        onDone?.();
        return;
      }
      form.applyUserErrors(payload?.userErrors ?? []);
    } catch {
      form.setError('root.server', { type: 'generic' });
    }
  });

  const serverError = errors.root?.['server']?.type?.toString();
  return (
    <form className={styles['form']} onSubmit={(e) => void onSubmit(e)} noValidate>
      <FormError code={serverError}>
        {serverError === 'PLAN_LIMIT_REACHED' && org && (
          <Link href={`/o/${org.slug}/settings/billing`}>{t('billing.upgradeLink')}</Link>
        )}
      </FormError>
      <Field
        label={t('customers.name')}
        autoComplete="off"
        errorCode={fieldErrorCode(errors.name, 'name')}
        {...form.register('name')}
      />
      <Field
        label={t('customers.email')}
        type="email"
        autoComplete="off"
        errorCode={fieldErrorCode(errors.email, 'email')}
        {...form.register('email', { setValueAs: emptyToNull })}
      />
      <div className={styles['row']}>
        <SelectField
          label={t('customers.currency')}
          errorCode={fieldErrorCode(errors.defaultCurrency, 'defaultCurrency')}
          {...form.register('defaultCurrency')}
        >
          {supportedCurrencies().map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('customers.documentLocale')}
          hint={t('customers.documentLocaleHint')}
          errorCode={fieldErrorCode(errors.documentLocale, 'documentLocale')}
          {...form.register('documentLocale')}
        >
          {DOCUMENT_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {locale}
            </option>
          ))}
        </SelectField>
      </div>
      <TextAreaField
        label={t('customers.billingAddress')}
        errorCode={fieldErrorCode(errors.billingAddress, 'billingAddress')}
        {...form.register('billingAddress', { setValueAs: emptyToNull })}
      />
      <button className={styles['submit']} type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('common.saving') : t(customer ? 'common.save' : 'customers.create')}
      </button>
    </form>
  );
}
