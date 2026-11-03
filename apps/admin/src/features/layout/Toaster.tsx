import { useEffect } from 'react';
import { t } from '@admin/i18n/t';
import { useAppDispatch, useAppSelector } from '@admin/store/hooks';
import { selectToasts, toastDismissed, type Toast } from '@admin/store/slices/toasts';
import styles from './Layout.module.scss';

export const TOAST_TIMEOUT_MS = 8000;

function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const timer = setTimeout(() => dispatch(toastDismissed(toast.id)), TOAST_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [dispatch, toast.id]);
  return (
    <li className={styles['toast']} data-tone={toast.tone}>
      <span>{toast.message}</span>
      <button type="button" onClick={() => dispatch(toastDismissed(toast.id))}>
        {t('toast.dismiss')}
      </button>
    </li>
  );
}

/** A polite live region that exists before any toast, so additions are announced. */
export function Toaster() {
  const toasts = useAppSelector(selectToasts);
  return (
    <section aria-label={t('toast.region')} aria-live="polite" className={styles['toasts']}>
      <ul>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </ul>
    </section>
  );
}
