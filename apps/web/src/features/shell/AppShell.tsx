'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, type ReactNode } from 'react';
import { getRefresher } from '@web/lib/auth/refresh';
import { Link, usePathname } from '@web/i18n/navigation';
import { useAppDispatch, useAppSelector } from '@web/store/hooks';
import { selectActiveOrg } from '@web/store/slices/session';
import { navClosed, navToggled } from '@web/store/slices/ui';
import { OrgSwitcher } from './OrgSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { Toaster } from './Toaster';
import { UserMenu } from './UserMenu';
import styles from './AppShell.module.scss';

function leave(href: string): void {
  window.location.assign(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname(); // without the locale prefix, e.g. /o/acme/customers
  const org = useAppSelector(selectActiveOrg);
  const navOpen = useAppSelector((state) => state.ui.navOpen);
  const dispatch = useAppDispatch();
  const navId = useId();

  // Signed out in another tab: follow.
  useEffect(
    () =>
      getRefresher().onSignedOut(() => {
        leave('/');
      }),
    [],
  );
  // Close the mobile navigation after navigating.
  useEffect(() => {
    dispatch(navClosed());
  }, [pathname, dispatch]);

  if (!org) return null;
  const base = `/o/${org.slug}`;
  const links = [
    { href: base, label: t('nav.dashboard') },
    { href: `${base}/customers`, label: t('nav.customers') },
  ];

  return (
    <div className={styles['shell']}>
      <a className="skip-link" href="#content">
        {t('a11y.skipToContent')}
      </a>
      <header className={styles['header']}>
        <button
          type="button"
          className={styles['navToggle']}
          aria-expanded={navOpen}
          aria-controls={navId}
          onClick={() => dispatch(navToggled())}
        >
          {navOpen ? t('shell.closeNavigation') : t('shell.openNavigation')}
        </button>
        <span className={styles['brand']}>{t('meta.title')}</span>
        <OrgSwitcher />
        <ThemeToggle />
        <UserMenu onSignedOut={leave} />
      </header>
      <nav
        id={navId}
        className={styles['nav']}
        aria-label={t('a11y.mainNavigation')}
        data-open={navOpen}
      >
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main id="content" className={styles['main']} tabIndex={-1}>
        {children}
      </main>
      <Toaster />
    </div>
  );
}
