import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { errorMessage } from '@admin/i18n/t';
import styles from './Form.module.scss';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly name: string;
  readonly hint?: string;
  readonly errorCode?: string | undefined;
}

/** A labelled input whose hint and error are announced with it (aria-describedby). */
export function Field({ label, name, hint, errorCode, ...input }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, errorCode ? errorId : null].filter(Boolean).join(' ');
  return (
    <div className={styles['field']}>
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={hintId} className={styles['hint']}>
          {hint}
        </p>
      )}
      <input
        id={id}
        name={name}
        aria-invalid={errorCode ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {errorCode && (
        <p id={errorId} className={styles['error']}>
          {errorMessage(errorCode)}
        </p>
      )}
    </div>
  );
}

/** An error for the whole form, announced when it appears. */
export function FormError({ code, children }: { code: string | undefined; children?: ReactNode }) {
  if (!code) return null;
  return (
    <div role="alert" className={styles['formError']}>
      {errorMessage(code)}
      {children}
    </div>
  );
}

export const fieldError = (
  errors: readonly { code: string; field: readonly string[] | null }[] | undefined,
  name: string,
): string | undefined => errors?.find((e) => e.field?.at(-1) === name)?.code;

export const formError = (
  errors: readonly { code: string; field: readonly string[] | null }[] | undefined,
): string | undefined => errors?.find((e) => !e.field || e.field.length === 0)?.code;
