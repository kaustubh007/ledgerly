import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * The sign-in steps between pages, in memory only (never storage): the enrolment secret to show
 * on the verification page, and recovery codes to show once afterwards. A reload loses them, and
 * sign-in starts again; that is the safe direction.
 */
export interface AuthFlowState {
  readonly enrolment: { readonly secret: string; readonly otpauthUri: string } | null;
  readonly recoveryCodes: readonly string[] | null;
}

const initialState: AuthFlowState = { enrolment: null, recoveryCodes: null };

export const authFlowSlice = createSlice({
  name: 'authFlow',
  initialState,
  reducers: {
    challengeStarted: (_state, action: PayloadAction<AuthFlowState['enrolment']>) => ({
      enrolment: action.payload,
      recoveryCodes: null,
    }),
    recoveryCodesIssued: (_state, action: PayloadAction<readonly string[]>) => ({
      enrolment: null,
      recoveryCodes: action.payload,
    }),
    authFlowCleared: () => initialState,
  },
});

export const { challengeStarted, recoveryCodesIssued, authFlowCleared } = authFlowSlice.actions;
