import { useId, useState, type ReactNode } from 'react';
import { FormError } from '@admin/components/Field';
import formStyles from '@admin/components/Form.module.scss';
import { errorMessage, t } from '@admin/i18n/t';

export interface ActionError {
  readonly code: string;
  readonly field: readonly string[] | null;
}

interface ActionFormProps {
  /** The button that opens the form (a disclosure: the form appears in place, no modal). */
  readonly label: ReactNode;
  readonly confirmLabel: string;
  readonly tone?: 'danger' | 'primary';
  /** Extra fields, e.g. the plan to change to. Read from the submitted FormData. */
  readonly children?: ReactNode;
  /** Resolves to the server's userErrors; an empty list closes the form. */
  readonly onSubmit: (values: {
    reason: string;
    form: FormData;
  }) => Promise<readonly ActionError[]>;
}

const MIN_REASON = 10;

/**
 * Every OPS action needs a reason (ADR-0004, E10-4): at least 10 characters, written to the audit
 * log. Checked here first for a quick answer, and again by the API.
 */
export function ActionForm({
  label,
  confirmLabel,
  tone = 'primary',
  children,
  onSubmit,
}: ActionFormProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<readonly ActionError[]>([]);
  const reasonError = errors.find((e) => e.field?.at(-1) === 'reason')?.code;
  const otherError = errors.find((e) => e.field?.at(-1) !== 'reason')?.code;

  async function submit(event: { preventDefault(): void; currentTarget: HTMLFormElement }) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const raw = form.get('reason');
    const reason = typeof raw === 'string' ? raw.trim() : '';
    if (reason.length < MIN_REASON) {
      setErrors([{ code: 'TOO_SMALL', field: ['input', 'reason'] }]);
      return;
    }
    setSubmitting(true);
    try {
      const result = await onSubmit({ reason, form });
      setErrors(result);
      if (result.length === 0) setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={tone === 'danger' ? formStyles['danger'] : formStyles['secondary']}
        aria-expanded="false"
        onClick={() => {
          setErrors([]);
          setOpen(true);
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <form className={formStyles['form']} onSubmit={(event) => void submit(event)} noValidate>
      <FormError code={otherError} />
      {children}
      <div className={formStyles['field']}>
        <label htmlFor={`${id}-reason`}>{t('action.reason')}</label>
        <p id={`${id}-hint`} className={formStyles['hint']}>
          {t('action.reasonHint')}
        </p>
        <textarea
          id={`${id}-reason`}
          name="reason"
          rows={3}
          required
          minLength={MIN_REASON}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={`${id}-hint${reasonError ? ` ${id}-error` : ''}`}
        />
        {reasonError && (
          <p id={`${id}-error`} className={formStyles['error']}>
            {errorMessage(reasonError)}
          </p>
        )}
      </div>
      <div className={formStyles['row']}>
        <button
          type="submit"
          className={tone === 'danger' ? formStyles['danger'] : formStyles['button']}
          disabled={submitting}
        >
          {submitting ? t('action.working') : confirmLabel}
        </button>
        <button type="button" className={formStyles['secondary']} onClick={() => setOpen(false)}>
          {t('action.cancel')}
        </button>
      </div>
    </form>
  );
}
