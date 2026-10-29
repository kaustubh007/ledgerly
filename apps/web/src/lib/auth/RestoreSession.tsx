'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { signInPath } from './paths';
import { getRefresher } from './refresh';

// Paths for which a refresh already succeeded in this tab. If the server still sees no session
// after that, refreshing again would loop forever; go to sign-in instead.
const restored = new Set<string>();

/**
 * Rendered by a Server Component that found no signed-in user. The access cookie may simply have
 * expired, and only the browser can send the refresh cookie (ADR-0005), so try that first.
 */
export function RestoreSession() {
  const t = useTranslations('auth');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    if (restored.has(pathname)) {
      router.replace(signInPath(pathname));
      return;
    }
    void getRefresher()
      .refresh()
      .then((ok) => {
        if (cancelled) return;
        if (ok) {
          restored.add(pathname);
          router.refresh();
        } else {
          router.replace(signInPath(pathname));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return <p role="status">{t('restoring')}</p>;
}
