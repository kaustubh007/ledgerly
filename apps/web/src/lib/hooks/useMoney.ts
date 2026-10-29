'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { formatMoney } from '@web/lib/format';

/** Formats an exact decimal amount for the current locale. */
export function useMoney(): (amount: string, currency: string) => string {
  const locale = useLocale();
  return useCallback((amount, currency) => formatMoney(amount, currency, locale), [locale]);
}
