'use client';

import { useMutation } from '@apollo/client/react';
import { LogInInput } from '@ledgerly/validation';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { LogInMutation } from '@web/graphql/documents';
import { safeNext } from '@web/lib/auth/paths';
import { Link } from '@web/i18n/navigation';
import { errorKey, fieldErrorCode } from './errors';
import { Field } from './Field';
import { useAuthForm } from './useAuthForm';
import styles from './AuthForm.module.scss';

export function SignInForm() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [logIn] = useMutation(LogInMutation);
  const form = useAuthForm(LogInInput, { email: '', password: '' });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (input) => {
    try {
      const { data } = await logIn({ variables: { input } });
      const result = data?.logIn;
      if (result?.viewer) {
        router.replace(safeNext(next, `/${locale}/o`));
        return;
      }
      form.applyUserErrors(result?.userErrors ?? []);
    } catch {
      form.setError('root.server', { type: 'generic', message: 'generic' });
    }
  });

  const serverError = errors.root?.['server']?.type?.toString();
  return (
    <form className={styles['form']} onSubmit={(e) => void onSubmit(e)} noValidate>
      {serverError && (
        <p role="alert" className={styles['formError']}>
          {t.has(errorKey(serverError)) ? t(errorKey(serverError)) : t('errors.generic')}
        </p>
      )}
      <Field
        label={t('auth.email')}
        type="email"
        autoComplete="email"
        errorCode={fieldErrorCode(errors.email, 'email')}
        {...form.register('email')}
      />
      <Field
        label={t('auth.password')}
        type="password"
        autoComplete="current-password"
        errorCode={fieldErrorCode(errors.password, 'password')}
        {...form.register('password')}
      />
      <button className={styles['submit']} type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('auth.submitting') : t('auth.signInSubmit')}
      </button>
      <p>
        {t('auth.noAccount')} <Link href="/sign-up">{t('auth.goToSignUp')}</Link>
      </p>
    </form>
  );
}
