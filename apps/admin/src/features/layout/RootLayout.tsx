import { Form, Link, NavLink, Outlet, useNavigation } from 'react-router';
import { useMeQuery } from '@admin/api/adminApi';
import { t } from '@admin/i18n/t';
import { useAppSelector } from '@admin/store/hooks';
import { selectRecentOrganizations } from '@admin/store/slices/recentOrganizations';
import styles from './Layout.module.scss';
import { Toaster } from './Toaster';

/** The signed-in shell: header, navigation, pending indicator, and the page in <Outlet/>. */
export function RootLayout() {
  const { data: me } = useMeQuery();
  const navigation = useNavigation();
  const recent = useAppSelector(selectRecentOrganizations);
  const loading = navigation.state === 'loading';

  return (
    <div className={styles['shell']}>
      <a className="skip-link" href="#content">
        {t('a11y.skipToContent')}
      </a>
      <header className={styles['header']}>
        <Link to="/organizations" className={styles['brand']}>
          {t('app.title')}
        </Link>
        {me && <span>{t('nav.signedInAs', { name: me.name, role: me.role })}</span>}
        <Form method="post" action="/sign-out">
          <button type="submit" className={styles['linkButton']}>
            {t('nav.signOut')}
          </button>
        </Form>
      </header>
      <div className={styles['progress']} data-active={loading} aria-hidden="true" />
      <p className="visually-hidden" role="status">
        {loading ? t('a11y.loading') : ''}
      </p>
      <nav className={styles['nav']} aria-label={t('a11y.mainNavigation')}>
        <ul>
          <li>
            <NavLink to="/organizations" end>
              {t('nav.organizations')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/audit">{t('nav.audit')}</NavLink>
          </li>
        </ul>
        {recent.length > 0 && (
          <>
            <h2 className={styles['navHeading']}>{t('nav.recent')}</h2>
            <ul>
              {recent.map((org) => (
                <li key={org.id}>
                  <NavLink to={`/organizations/${org.id}`}>{org.name}</NavLink>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
      <main id="content" className={styles['main']} tabIndex={-1}>
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
