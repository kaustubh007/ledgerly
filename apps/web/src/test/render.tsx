import { render, type RenderOptions } from '@testing-library/react';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import { expect } from 'vitest';
import en from '@web/messages/en.json';
import { StoreProvider } from '@web/store/StoreProvider';
import type { RootState } from '@web/store/store';
import { discardSink } from '@web/store/middleware/analytics';
import type { PreferenceEffects } from '@web/store/middleware/preferences';

export const noPreferenceEffects: PreferenceEffects = {
  writeCookie: () => undefined,
  applyTheme: () => undefined,
};

export interface ProviderOptions {
  readonly preloadedState?: Partial<RootState>;
  readonly locale?: string;
  readonly messages?: Record<string, unknown>;
}

/** Renders inside the same providers the app uses: translations and a fresh Redux store. */
export function renderWithProviders(
  ui: ReactElement,
  options: ProviderOptions & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { preloadedState, locale = 'en', messages = en, ...rest } = options;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        <StoreProvider
          {...(preloadedState ? { preloadedState } : {})}
          options={{ preferenceEffects: noPreferenceEffects, analytics: discardSink }}
        >
          {children}
        </StoreProvider>
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...rest });
}

/**
 * axe in jsdom. Colour contrast cannot be computed without layout, so it is checked only by the
 * Playwright run (PLAN §3.11); everything else (names, roles, ARIA, labels) is checked here.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

export const sessionState = (
  overrides: Partial<RootState['session']> = {},
): RootState['session'] => ({
  viewer: { id: 'u1', name: 'Ada', email: 'ada@example.com' },
  activeOrg: { slug: 'acme', name: 'Acme', role: 'OWNER' },
  memberships: [
    { slug: 'acme', name: 'Acme', role: 'OWNER' },
    { slug: 'globex', name: 'Globex', role: 'VIEWER' },
  ],
  ...overrides,
});
