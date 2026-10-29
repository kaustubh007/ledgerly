import type { ThemePreference } from '@web/store/slices/ui';

export function parseTheme(value: string | undefined): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}
