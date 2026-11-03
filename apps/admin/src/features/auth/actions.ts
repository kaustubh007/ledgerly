import { redirect, type ActionFunctionArgs } from 'react-router';
import { adminApi } from '@admin/api/adminApi';
import type { AdminApiError } from '@admin/api/baseQuery';
import { authFlowCleared, challengeStarted, recoveryCodesIssued } from '@admin/store/slices/auth';
import type { AppStore } from '@admin/store/store';
import { safeNext } from './safeNext';

export interface FormErrors {
  readonly errors: readonly { readonly code: string; readonly field: readonly string[] | null }[];
}

const failed = (error: unknown): FormErrors => ({
  errors: [{ code: (error as AdminApiError | undefined)?.code ?? 'generic', field: [] }],
});

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

/** Route action for `/sign-in`: email and password, then on to the code. */
export const signInAction =
  (store: AppStore) =>
  async ({ request }: ActionFunctionArgs): Promise<FormErrors | Response> => {
    const form = await request.formData();
    const input = { email: text(form, 'email'), password: text(form, 'password') };
    try {
      const result = await store.dispatch(adminApi.endpoints.signIn.initiate(input)).unwrap();
      if (result.userErrors.length > 0 || !result.next) return { errors: result.userErrors };
      store.dispatch(challengeStarted(result.enrolment ?? null));
      return redirect(`/sign-in/verify${new URL(request.url).search}`);
    } catch (error) {
      return failed(error);
    }
  };

/** Route action for `/sign-in/verify`: the TOTP or recovery code. */
export const verifyAction =
  (store: AppStore) =>
  async ({ request }: ActionFunctionArgs): Promise<FormErrors | Response> => {
    const form = await request.formData();
    const next = safeNext(new URL(request.url).searchParams.get('next'));
    try {
      const result = await store
        .dispatch(adminApi.endpoints.verifyMfa.initiate({ code: text(form, 'code') }))
        .unwrap();
      if (result.userErrors.length > 0 || !result.staff) return { errors: result.userErrors };
      if (result.recoveryCodes) {
        store.dispatch(recoveryCodesIssued(result.recoveryCodes));
        return redirect(`/sign-in/recovery-codes?next=${encodeURIComponent(next)}`);
      }
      store.dispatch(authFlowCleared());
      return redirect(next);
    } catch (error) {
      return failed(error);
    }
  };

/** Route action for `/sign-out`. Forget every cached answer: the next staff member starts clean. */
export const signOutAction = (store: AppStore) => async (): Promise<Response> => {
  try {
    await store.dispatch(adminApi.endpoints.signOut.initiate()).unwrap();
  } finally {
    store.dispatch(adminApi.util.resetApiState());
    store.dispatch(authFlowCleared());
  }
  return redirect('/sign-in');
};
