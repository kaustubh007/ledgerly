'use client';

import { useTranslations } from 'next-intl';

/** Error boundary for the org area (Next.js renders it when a page or layout below throws). */
export default function OrgError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <div role="alert">
      <p>{t('generic')}</p>
      <button type="button" onClick={reset}>
        ↻
      </button>
    </div>
  );
}
