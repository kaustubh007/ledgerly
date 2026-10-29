'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useAppDispatch, useAppSelector } from '@web/store/hooks';
import { themeChanged, type ThemePreference } from '@web/store/slices/ui';

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];
const LABEL_KEYS = { system: 'themeSystem', light: 'themeLight', dark: 'themeDark' } as const;

export function ThemeToggle() {
  const t = useTranslations('shell');
  const id = useId();
  const theme = useAppSelector((state) => state.ui.theme);
  const dispatch = useAppDispatch();
  return (
    <span>
      <label htmlFor={id}>{t('theme')} </label>
      <select
        id={id}
        value={theme}
        onChange={(event) => dispatch(themeChanged(event.target.value as ThemePreference))}
      >
        {THEMES.map((value) => (
          <option key={value} value={value}>
            {t(LABEL_KEYS[value])}
          </option>
        ))}
      </select>
    </span>
  );
}
