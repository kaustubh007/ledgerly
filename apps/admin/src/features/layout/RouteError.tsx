import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { t } from '@admin/i18n/t';

/** errorElement: a loader or render that throws lands here instead of a blank page. */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div role="alert">
      <h1>{notFound ? t('error.notFound') : t('error.title')}</h1>
      {notFound && typeof error.data === 'string' && <p>{error.data}</p>}
      <p>
        <Link to="/organizations">{t('error.back')}</Link>
      </p>
    </div>
  );
}
