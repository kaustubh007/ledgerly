'use client';

import { useMutation } from '@apollo/client/react';
import { SignUpInput } from '@ledgerly/validation';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { SignUpMutation } from '@web/graphql/documents';
import { Link } from '@web/i18n/navigation';
import { errorKey, fieldErrorCode } from './errors';
import { Field } from './Field';
import { useAuthForm } from './useAuthForm';
import styles from './AuthForm.module.scss';

export function SignUpForm() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [signUp] = useMutation(SignUpMutation);
  const form = useAuthForm(SignUpInput, {
    name: '',
    email: '',
    password: '',
    organizationName: '',
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (input) => {
    try {
      const { data } = await signUp({ variables: { input } });
      const result = data?.signUp;
      if (result?.viewer) {
        router.replace(`/${locale}/o`);
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
        label={t('auth.name')}
        autoComplete="name"
        errorCode={fieldErrorCode(errors.name, 'name')}
        {...form.register('name')}
      />
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
        autoComplete="new-password"
        errorCode={fieldErrorCode(errors.password, 'password')}
        {...form.register('password')}
      />
      <Field
        label={t('auth.organizationName')}
        autoComplete="organization"
        errorCode={fieldErrorCode(errors.organizationName, 'organizationName')}
        {...form.register('organizationName')}
      />
      <button className={styles['submit']} type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('auth.submitting') : t('auth.signUpSubmit')}
      </button>
      <p>
        {t('auth.haveAccount')} <Link href="/sign-in">{t('auth.goToSignIn')}</Link>
      </p>
    </form>
  );
}
