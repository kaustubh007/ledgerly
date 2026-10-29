'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { usePermission } from '@web/lib/hooks/usePermission';
import { CustomerForm } from './CustomerForm';
import styles from '@web/features/shell/AppShell.module.scss';

/** "Add customer" as a disclosure above the list: create without leaving the page. */
export function NewCustomer() {
  const t = useTranslations('customers');
  const allowed = usePermission('customers:write');
  const details = useRef<HTMLDetailsElement>(null);
  if (!allowed) return null;
  return (
    <details ref={details} className={styles['panel']}>
      <summary>{t('add')}</summary>
      <CustomerForm
        onDone={() => {
          if (details.current) details.current.open = false;
        }}
      />
    </details>
  );
}
