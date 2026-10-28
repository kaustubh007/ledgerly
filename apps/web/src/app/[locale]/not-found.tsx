import { getTranslations } from 'next-intl/server';
import { Link } from '@web/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <main id="content" style={{ padding: 'var(--space-4)' }}>
      <h1>{t('title')}</h1>
      <Link href="/o">{t('back')}</Link>
    </main>
  );
}
