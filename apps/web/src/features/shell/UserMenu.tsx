'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { CSRF_HEADER, getRefresher } from '@web/lib/auth/refresh';
import { useAppDispatch, useAppSelector } from '@web/store/hooks';
import { selectViewer, signedOut } from '@web/store/slices/session';
import { LOGOUT_URL } from './constants';
import styles from './AppShell.module.scss';

export function UserMenu({ onSignedOut }: { onSignedOut: (signInHref: string) => void }) {
  const t = useTranslations('shell');
  const locale = useLocale();
  const viewer = useAppSelector(selectViewer);
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);
  if (!viewer) return null;

  async function signOut() {
    setBusy(true);
    try {
      await fetch(LOGOUT_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { [CSRF_HEADER]: '1' },
      });
    } catch {
      // Offline or the API is down: the server session may live on until it expires, but this
      // browser is signed out regardless, which is what the user asked for.
    } finally {
      dispatch(signedOut());
      getRefresher().announceSignedOut(); // other tabs follow
      onSignedOut(`/${locale}/sign-in`);
    }
  }

  return (
    <details className={styles['menu']}>
      <summary aria-label={`${t('account')}: ${viewer.name}`}>{viewer.name}</summary>
      <ul>
        <li>
          <span className="visually-hidden">{viewer.email}</span>
        </li>
        <li>
          <button type="button" onClick={() => void signOut()} disabled={busy}>
            {t('signOut')}
          </button>
        </li>
      </ul>
    </details>
  );
}
