import { Form, useActionData, useNavigation } from 'react-router';
import { Field, fieldError, FormError, formError } from '@admin/components/Field';
import formStyles from '@admin/components/Form.module.scss';
import { t } from '@admin/i18n/t';
import type { FormErrors } from './actions';
import styles from './AuthPages.module.scss';

/** Step 1 of 2. A route action (`signInAction`) handles the POST; no component state. */
export function SignInPage() {
  const result = useActionData<FormErrors>();
  const submitting = useNavigation().state === 'submitting';
  return (
    <main className={styles['page']}>
      <div className={styles['card']}>
        <h1>{t('signIn.title')}</h1>
        <Form method="post" className={formStyles['form']} noValidate>
          <FormError code={formError(result?.errors)} />
          <Field
            label={t('signIn.email')}
            name="email"
            type="email"
            autoComplete="username"
            required
            errorCode={fieldError(result?.errors, 'email')}
          />
          <Field
            label={t('signIn.password')}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            errorCode={fieldError(result?.errors, 'password')}
          />
          <button className={formStyles['button']} type="submit" disabled={submitting}>
            {submitting ? t('signIn.submitting') : t('signIn.submit')}
          </button>
        </Form>
      </div>
    </main>
  );
}
