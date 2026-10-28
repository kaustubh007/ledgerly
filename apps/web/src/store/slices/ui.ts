import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface UiState {
  readonly theme: ThemePreference;
  readonly navOpen: boolean;
}

export const initialUiState: UiState = { theme: 'system', navOpen: false };

export const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUiState,
  reducers: {
    themeChanged(state, action: PayloadAction<ThemePreference>) {
      state.theme = action.payload;
    },
    navToggled(state) {
      state.navOpen = !state.navOpen;
    },
    navClosed(state) {
      state.navOpen = false;
    },
  },
});

export const { themeChanged, navToggled, navClosed } = uiSlice.actions;
