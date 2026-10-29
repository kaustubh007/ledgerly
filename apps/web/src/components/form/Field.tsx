'use client';

import { useTranslations } from 'next-intl';
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { errorKey } from './errors';
import styles from './Form.module.scss';

interface Common {
  readonly label: string;
  readonly errorCode: string | undefined;
  readonly hint?: string;
}

/** Translates an error code, falling back to the generic message for codes without a text. */
function useErrorMessage(code: string | undefined): string | undefined {
  const t = useTranslations();
  if (!code) return undefined;
  return t.has(errorKey(code)) ? t(errorKey(code)) : t('errors.generic');
}

/**
 * Label, control, hint and error, wired the accessible way: the label names the control,
 * hint and error describe it (aria-describedby), and an error marks it aria-invalid.
 */
function FieldShell({
  label,
  errorCode,
  hint,
  children,
}: Common & {
  children: (a11y: {
    id: string;
    'aria-invalid': true | undefined;
    'aria-describedby': string | undefined;
  }) => ReactNode;
}) {
  const id = useId();
  const message = useErrorMessage(errorCode);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = message ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles['field']}>
      <label htmlFor={id}>{label}</label>
      {hint && (
        <span id={hintId} className={styles['hint']}>
          {hint}
        </span>
      )}
      {children({
        id,
        'aria-invalid': message ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {message && (
        <p id={errorId} className={styles['error']}>
          {message}
        </p>
      )}
    </div>
  );
}

export function Field({
  label,
  errorCode,
  hint,
  ...input
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} errorCode={errorCode} {...(hint ? { hint } : {})}>
      {(a11y) => <input {...a11y} {...input} />}
    </FieldShell>
  );
}

export function SelectField({
  label,
  errorCode,
  hint,
  children,
  ...select
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} errorCode={errorCode} {...(hint ? { hint } : {})}>
      {(a11y) => (
        <select className={styles['select']} {...a11y} {...select}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  errorCode,
  hint,
  ...textarea
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} errorCode={errorCode} {...(hint ? { hint } : {})}>
      {(a11y) => <textarea rows={3} {...a11y} {...textarea} />}
    </FieldShell>
  );
}

/** A form-level error (role=alert: announced as soon as it appears). */
export function FormError({ code, children }: { code: string | undefined; children?: ReactNode }) {
  const message = useErrorMessage(code);
  if (!message) return null;
  return (
    <div role="alert" className={styles['formError']}>
      <p style={{ margin: 0 }}>{message}</p>
      {children}
    </div>
  );
}
