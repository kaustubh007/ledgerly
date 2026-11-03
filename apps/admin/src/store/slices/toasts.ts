import { createEntityAdapter, createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

export interface Toast {
  readonly id: string;
  readonly tone: 'success' | 'error' | 'info';
  readonly message: string;
}

const adapter = createEntityAdapter<Toast>();

export const toastsSlice = createSlice({
  name: 'toasts',
  initialState: adapter.getInitialState(),
  reducers: {
    toastAdded: {
      reducer: (state, action: PayloadAction<Toast>) => {
        adapter.addOne(state, action.payload);
      },
      // Ids are made here, not in the reducer, so the reducer stays pure.
      prepare: (toast: Omit<Toast, 'id'>) => ({ payload: { ...toast, id: nanoid() } }),
    },
    toastDismissed: (state, action: PayloadAction<string>) => {
      adapter.removeOne(state, action.payload);
    },
  },
});

export const { toastAdded, toastDismissed } = toastsSlice.actions;
export const { selectAll: selectToasts } = adapter.getSelectors(
  (state: { toasts: ReturnType<typeof toastsSlice.reducer> }) => state.toasts,
);
