import type { OrganizationStatus } from '@admin/graphql/__generated__/graphql';
import { t } from '@admin/i18n/t';
import styles from './Organizations.module.scss';

/** Text, not colour alone. */
export function StatusBadge({ status }: { status: OrganizationStatus }) {
  return (
    <span className={styles['badge']} data-status={status}>
      {t(`status.${status}`)}
    </span>
  );
}
