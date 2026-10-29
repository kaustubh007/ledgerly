'use client';

import { useCallback, useState } from 'react';

/**
 * One idempotency key per *attempt to do one thing* (ADR-0002). The key is made when the form
 * appears and kept across retries and double clicks, so the server does the work once; it is
 * renewed only after the attempt succeeded, so the *next* payment is a new one.
 */
export function useIdempotencyKey(): readonly [key: string, renew: () => void] {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const renew = useCallback(() => {
    setKey(crypto.randomUUID());
  }, []);
  return [key, renew] as const;
}
