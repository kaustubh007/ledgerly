import { getLocale, getTranslations } from 'next-intl/server';
import { formatMoney } from '@web/lib/format';
import styles from '@web/features/shell/AppShell.module.scss';

export interface TotalsRow {
  readonly currency: string;
  readonly outstanding: { readonly amount: string };
  readonly overdue: { readonly amount: string };
}

/**
 * A Server Component: no JavaScript is sent for it. One row per currency: amounts in different
 * currencies are never added up (CLAUDE.md).
 */
export async function CurrencyTotals({ totals }: { totals: readonly TotalsRow[] }) {
  const t = await getTranslations('dashboard');
  const locale = await getLocale();
  if (totals.length === 0) return <p>{t('empty')}</p>;
  return (
    <table className={styles['table']}>
      <caption>{t('totalsCaption')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('currency')}</th>
          <th scope="col">{t('outstanding')}</th>
          <th scope="col">{t('overdue')}</th>
        </tr>
      </thead>
      <tbody>
        {totals.map((row) => (
          <tr key={row.currency}>
            <th scope="row">{row.currency}</th>
            <td data-numeric>{formatMoney(row.outstanding.amount, row.currency, locale)}</td>
            <td data-numeric>{formatMoney(row.overdue.amount, row.currency, locale)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
