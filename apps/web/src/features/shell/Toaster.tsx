'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@web/store/hooks';
import { toastDismissed } from '@web/store/slices/toasts';
import styles from './AppShell.module.scss';

export const TOAST_TIMEOUT_MS = 6000;

/**
 * Notifications in a polite live region: screen readers announce new ones without interrupting.
 * The region is always in the DOM (an empty one), because a live region created at the same
 * moment as its content is often not announced.
 */
export function Toaster() {
  const t = useTranslations('shell');
  const toasts = useAppSelector((state) => state.toasts);
  const dispatch = useAppDispatch();

  const newest = toasts.at(-1)?.id;
  useEffect(() => {
    if (!newest) return;
    const timer = setTimeout(() => dispatch(toastDismissed(newest)), TOAST_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [newest, dispatch]);

  return (
    <section aria-label={t('notifications')}>
      <ul className={styles['toaster']} aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <li key={toast.id} className={styles['toast']} data-tone={toast.tone}>
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => dispatch(toastDismissed(toast.id))}
              aria-label={t('dismiss')}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
