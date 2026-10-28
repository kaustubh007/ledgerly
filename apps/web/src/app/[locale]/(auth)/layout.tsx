import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { parseTheme } from '@web/lib/theme';
import { THEME_COOKIE } from '@web/store/middleware/preferences';
import { StoreProvider } from '@web/store/StoreProvider';
import { initialUiState } from '@web/store/slices/ui';
import styles from '@web/features/auth/AuthForm.module.scss';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <StoreProvider preloadedState={{ ui: { ...initialUiState, theme } }}>
      <main id="content" className={styles['page']}>
        <div className={styles['card']}>{children}</div>
      </main>
    </StoreProvider>
  );
}
