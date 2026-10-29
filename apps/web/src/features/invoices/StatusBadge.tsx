'use client';

import { useTranslations } from 'next-intl';
import type { InvoiceStatus } from '@web/graphql/__generated__/graphql';
import styles from './Invoices.module.scss';

/** Status as text, never colour alone (WCAG 1.4.1): the colour only repeats what the word says. */
export function StatusBadge({
  status,
  overdue = false,
}: {
  status: InvoiceStatus;
  overdue?: boolean;
}) {
  const t = useTranslations('invoices.status');
  return (
    <span className={styles['badge']} data-status={overdue ? 'OVERDUE' : status}>
      {t(status)}
      {overdue && ` · ${t('OVERDUE')}`}
    </span>
  );
}
