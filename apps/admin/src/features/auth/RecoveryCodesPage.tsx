import { Link, Navigate, useSearchParams } from 'react-router';
import formStyles from '@admin/components/Form.module.scss';
import { t } from '@admin/i18n/t';
import { useAppDispatch, useAppSelector } from '@admin/store/hooks';
import { authFlowCleared } from '@admin/store/slices/auth';
import styles from './AuthPages.module.scss';
import { safeNext } from './safeNext';

/** Shown once, right after enrolment. Leaving the page forgets the codes (memory only). */
export function RecoveryCodesPage() {
  const codes = useAppSelector((state) => state.authFlow.recoveryCodes);
  const dispatch = useAppDispatch();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  if (!codes) return <Navigate to={next} replace />;
  return (
    <main className={styles['page']}>
      <div className={styles['card']}>
        <h1>{t('recovery.title')}</h1>
        <p>{t('recovery.intro')}</p>
        <ul className={styles['codes']} aria-label={t('recovery.title')}>
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Link
          className={formStyles['button']}
          to={next}
          replace
          onClick={() => dispatch(authFlowCleared())}
        >
          {t('recovery.continue')}
        </Link>
      </div>
    </main>
  );
}
