'use client';

import { useMutation } from '@apollo/client/react';
import { canPerform } from '@ledgerly/domain';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FormError } from '@web/components/form/Field';
import styles from '@web/components/form/Form.module.scss';
import type { InvoiceStatus } from '@web/graphql/__generated__/graphql';
import { SendInvoiceMutation, VoidInvoiceMutation } from '@web/graphql/documents';
import { useIdempotencyKey } from '@web/lib/hooks/useIdempotencyKey';
import { usePermission } from '@web/lib/hooks/usePermission';
import { useToast } from '@web/lib/hooks/useToast';
import local from './Invoices.module.scss';

/**
 * Send and Void, offered only when the domain's state machine allows them in this status and the
 * member's role allows invoices:write (the same tables the API enforces). The mutations return
 * the whole invoice, so Apollo's normalised cache re-renders the page with the new status.
 */
export function InvoiceActions({ id, status }: { id: string; status: InvoiceStatus }) {
  const t = useTranslations('invoices');
  const toast = useToast();
  const allowed = usePermission('invoices:write');
  const [key, renew] = useIdempotencyKey();
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [send, { loading: sending }] = useMutation(SendInvoiceMutation);
  const [voidIt, { loading: voiding }] = useMutation(VoidInvoiceMutation);
  if (!allowed) return null;

  const canSend = canPerform(status, 'SEND');
  const canVoid = canPerform(status, 'VOID');
  if (!canSend && !canVoid) return null;

  async function onSend() {
    setError(undefined);
    const { data } = await send({ variables: { id, key } });
    const number = data?.sendInvoice.invoice?.number;
    if (number) {
      renew();
      toast('success', t('sent', { number }));
    } else setError(data?.sendInvoice.userErrors[0]?.code ?? 'generic');
  }

  async function onVoid() {
    setError(undefined);
    const { data } = await voidIt({ variables: { id } });
    setConfirmingVoid(false);
    if (data?.voidInvoice.invoice) toast('info', t('voided'));
    else setError(data?.voidInvoice.userErrors[0]?.code ?? 'generic');
  }

  return (
    <div>
      <FormError code={error} />
      <div className={local['actions']}>
        {canSend && (
          <button
            type="button"
            className={styles['submit']}
            disabled={sending}
            onClick={() => void onSend()}
          >
            {sending ? t('sending') : t('send')}
          </button>
        )}
        {canVoid &&
          (confirmingVoid ? (
            <>
              <button
                type="button"
                className={styles['danger']}
                disabled={voiding}
                onClick={() => void onVoid()}
              >
                {t('confirmVoid')}
              </button>
              <button
                type="button"
                className={styles['secondary']}
                onClick={() => setConfirmingVoid(false)}
              >
                {t('cancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles['secondary']}
              onClick={() => setConfirmingVoid(true)}
            >
              {t('void')}
            </button>
          ))}
      </div>
    </div>
  );
}
