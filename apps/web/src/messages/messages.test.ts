import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { routing } from '@web/i18n/routing';
import ar from './ar.json';
import de from './de.json';
import en from './en.json';

const ALL = { en, de, ar } as const;

function keys(value: unknown, prefix = ''): string[] {
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('messages', () => {
  it('has a file for every locale', () => {
    expect(Object.keys(ALL).sort()).toEqual([...routing.locales].sort());
  });

  it.each(['de', 'ar'] as const)('%s has exactly the same keys as en', (locale) => {
    expect(keys(ALL[locale]).sort()).toEqual(keys(en).sort());
  });

  it.each(Object.entries(ALL))('%s ICU plurals compile and format', (locale, messages) => {
    const t = createTranslator({ locale, messages, namespace: 'dashboard' });
    for (const count of [0, 1, 2, 5, 11, 100])
      expect(t('invoiceCount', { count })).not.toContain('{');
  });

  it('uses the Arabic plural categories', () => {
    const t = createTranslator({ locale: 'ar', messages: ar, namespace: 'dashboard' });
    expect(t('invoiceCount', { count: 2 })).toBe('فاتورتان');
  });
});
