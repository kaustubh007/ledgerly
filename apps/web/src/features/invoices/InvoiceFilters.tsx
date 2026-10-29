'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId, useOptimistic, useTransition } from 'react';
import formStyles from '@web/components/form/Form.module.scss';
import { STATUSES } from './constants';
import styles from './Invoices.module.scss';

/**
 * Filters live in the URL (PLAN §3.8): shareable, bookmarkable, back-button friendly, and the
 * Server Component reads them to preload the right data. Changing one replaces the query string;
 * the transition keeps the old list visible (marked busy) until the new one has arrived.
 */
export function InvoiceFilters({
  customers,
}: {
  customers: readonly { id: string; name: string }[];
}) {
  const t = useTranslations('invoices');
  const router = useRouter();
  const pathname = usePathname();
  const committed = useSearchParams();
  const [pending, startTransition] = useTransition();
  // The URL only changes when the navigation commits. Until then, the optimistic query string is
  // what the user asked for: the selects show it at once, and a second change builds on it
  // instead of on the stale URL (which would silently undo the first change).
  const [query, setQuery] = useOptimistic(committed.toString());
  const params = new URLSearchParams(query);
  const statusId = useId();
  const customerId = useId();

  function update(name: 'status' | 'customer', value: string) {
    const next = new URLSearchParams(query);
    if (value) next.set(name, value);
    else next.delete(name);
    const nextQuery = next.toString();
    startTransition(() => {
      setQuery(nextQuery);
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    });
  }

  return (
    <search className={styles['filters']} aria-busy={pending} aria-label={t('filters')}>
      <div>
        <label htmlFor={statusId}>{t('statusFilter')} </label>
        <select
          id={statusId}
          className={formStyles['select']}
          value={params.get('status') ?? ''}
          onChange={(e) => update('status', e.target.value)}
        >
          <option value="">{t('all')}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={customerId}>{t('customerFilter')} </label>
        <select
          id={customerId}
          className={formStyles['select']}
          value={params.get('customer') ?? ''}
          onChange={(e) => update('customer', e.target.value)}
        >
          <option value="">{t('all')}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </search>
  );
}
