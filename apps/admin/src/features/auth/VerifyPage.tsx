import { Form, Link, useActionData, useNavigation } from 'react-router';
import { Field, fieldError, FormError, formError } from '@admin/components/Field';
import formStyles from '@admin/components/Form.module.scss';
import { t } from '@admin/i18n/t';
import { useAppSelector } from '@admin/store/hooks';
import type { FormErrors } from './actions';
import styles from './AuthPages.module.scss';

/** Step 2 of 2: always a code. On the first sign-in, enrol the authenticator first. */
export function VerifyPage() {
  const enrolment = useAppSelector((state) => state.authFlow.enrolment);
  const result = useActionData<FormErrors>();
  const submitting = useNavigation().state === 'submitting';
  return (
    <main className={styles['page']}>
      <div className={styles['card']}>
        <h1>{t('verify.title')}</h1>
        {enrolment ? (
          <>
            <p>{t('verify.enrolIntro')}</p>
            <p>
              {t('verify.secret')}:{' '}
              <code className={styles['secret']} data-testid="totp-secret">
                {enrolment.secret}
              </code>
            </p>
            <p className={styles['uri']}>
              {t('verify.uri')}: <code>{enrolment.otpauthUri}</code>
            </p>
          </>
        ) : (
          <p>{t('verify.prompt')}</p>
        )}
        <Form method="post" className={formStyles['form']} noValidate>
          <FormError code={formError(result?.errors)}>
            {' '}
            <Link to="/sign-in">{t('verify.restart')}</Link>
          </FormError>
          <Field
            label={t('verify.code')}
            name="code"
            autoComplete="one-time-code"
            inputMode="text"
            required
            errorCode={fieldError(result?.errors, 'code')}
          />
          <button className={formStyles['button']} type="submit" disabled={submitting}>
            {submitting ? t('verify.submitting') : t('verify.submit')}
          </button>
        </Form>
      </div>
    </main>
  );
}
