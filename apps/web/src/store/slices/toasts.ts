import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

export interface Toast {
  readonly id: string;
  readonly tone: 'info' | 'success' | 'error';
  /** Already-translated text: the slice stores what to show, not how to translate it. */
  readonly message: string;
}

export const MAX_TOASTS = 3;

export const toastsSlice = createSlice({
  name: 'toasts',
  initialState: [] as Toast[],
  reducers: {
    toastAdded: {
      reducer(state, action: PayloadAction<Toast>) {
        state.push(action.payload);
        // Oldest first out: never let notifications pile up over the content.
        if (state.length > MAX_TOASTS) state.splice(0, state.length - MAX_TOASTS);
      },
      // `prepare` keeps the reducer pure: the random id is made before the action is dispatched.
      prepare(toast: Omit<Toast, 'id'>) {
        return { payload: { ...toast, id: nanoid() } };
      },
    },
    toastDismissed(state, action: PayloadAction<string>) {
      return state.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { toastAdded, toastDismissed } = toastsSlice.actions;
