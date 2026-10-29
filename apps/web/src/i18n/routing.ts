import { defineRouting } from 'next-intl/routing';

// PLAN §3.11: locale-prefixed routes. Arabic is here on purpose: it forces right-to-left layout
// to work from the first screen, not as a retrofit.
export const routing = defineRouting({
  locales: ['en', 'de', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

export const RTL_LOCALES: readonly Locale[] = ['ar'];

export function directionOf(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}
