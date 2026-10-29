'use client';

import { useCallback } from 'react';
import { useAppDispatch } from '@web/store/hooks';
import { toastAdded, type Toast } from '@web/store/slices/toasts';

/** `toast('success', t('saved'))`: shows in the polite live region, so it is also announced. */
export function useToast(): (tone: Toast['tone'], message: string) => void {
  const dispatch = useAppDispatch();
  return useCallback((tone, message) => dispatch(toastAdded({ tone, message })), [dispatch]);
}
