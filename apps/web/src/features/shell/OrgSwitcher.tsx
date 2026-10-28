'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { selectActiveOrg, selectOtherOrgs } from '@web/store/slices/session';
import { useAppSelector } from '@web/store/hooks';
import styles from './AppShell.module.scss';

/** The same page in another organisation: `/en/o/acme/customers` → `/en/o/globex/customers`. */
export function hrefInOrg(pathname: string, locale: string, slug: string): string {
  const rest = /^\/[a-z]{2}\/o\/[^/]+(\/.*)?$/.exec(pathname)?.[1] ?? '';
  return `/${locale}/o/${slug}${rest}`;
}

/**
 * Lists the other organisations as plain links. Deliberately *not* client-side navigation:
 * switching org reloads the page, so no cached data from the previous org can survive into the
 * next one (Apollo's cache is not keyed by organisation). See DECISIONS.md, Phase 3.
 */
export function OrgSwitcher() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const active = useAppSelector(selectActiveOrg);
  const others = useAppSelector(selectOtherOrgs);
  if (!active) return null;

  const label = `${active.name} (${t(`roles.${active.role}`)})`;
  if (others.length === 0) {
    return (
      <p style={{ margin: 0 }}>
        <span className="visually-hidden">{t('shell.organization')}: </span>
        {label}
      </p>
    );
  }
  return (
    <details className={styles['menu']}>
      <summary aria-label={`${t('shell.switchOrganization')}: ${label}`}>{label}</summary>
      <ul>
        {others.map((org) => (
          <li key={org.slug}>
            <a href={hrefInOrg(pathname, locale, org.slug)}>
              {org.name} <span className="visually-hidden">({t(`roles.${org.role}`)})</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
