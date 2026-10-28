'use client';

import { useTranslations } from 'next-intl';
import { useId, type InputHTMLAttributes } from 'react';
import { errorKey } from './errors';
import styles from './AuthForm.module.scss';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  errorCode: string | undefined;
};

/** A labelled input whose error is linked with aria-describedby and flagged with aria-invalid. */
export function Field({ label, errorCode, ...input }: Props) {
  const t = useTranslations();
  const id = useId();
  const errorId = `${id}-error`;
  const message = errorCode
    ? t.has(errorKey(errorCode))
      ? t(errorKey(errorCode))
      : t('errors.generic')
    : undefined;
  return (
    <div className={styles['field']}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
        {...input}
      />
      {message && (
        <p id={errorId} className={styles['error']}>
          {message}
        </p>
      )}
    </div>
  );
}
