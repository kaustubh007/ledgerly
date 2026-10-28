import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type Role = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER';

export interface OrgSummary {
  readonly slug: string;
  readonly name: string;
  readonly role: Role;
}

/**
 * A *view* of the session for the UI: who is signed in and which org is active. It is filled by
 * the server on each request and is never the authority: the API checks every call itself.
 */
export interface SessionState {
  readonly viewer: { readonly id: string; readonly name: string; readonly email: string } | null;
  readonly activeOrg: OrgSummary | null;
  readonly memberships: readonly OrgSummary[];
}

export const initialSessionState: SessionState = { viewer: null, activeOrg: null, memberships: [] };

export const sessionSlice = createSlice({
  name: 'session',
  initialState: initialSessionState,
  reducers: {
    sessionLoaded(_state, action: PayloadAction<SessionState>) {
      return action.payload;
    },
    signedOut() {
      return initialSessionState;
    },
  },
  selectors: {
    selectViewer: (state) => state.viewer,
    selectActiveOrg: (state) => state.activeOrg,
    selectOtherOrgs: (state) => state.memberships.filter((m) => m.slug !== state.activeOrg?.slug),
  },
});

export const { sessionLoaded, signedOut } = sessionSlice.actions;
export const { selectViewer, selectActiveOrg, selectOtherOrgs } = sessionSlice.selectors;
