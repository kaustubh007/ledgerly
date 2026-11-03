import {
  createEntityAdapter,
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

/** An organisation a staff member opened, for the "Recently viewed" list. UI state only. */
export interface RecentOrganization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly viewedAt: number;
}

export const RECENT_LIMIT = 5;

// Normalised: { ids: [...], entities: { [id]: org } }, kept sorted newest first by the adapter.
const adapter = createEntityAdapter<RecentOrganization>({
  sortComparer: (a, b) => b.viewedAt - a.viewedAt,
});

export const recentOrganizationsSlice = createSlice({
  name: 'recentOrganizations',
  initialState: adapter.getInitialState(),
  reducers: {
    organizationViewed: (state, action: PayloadAction<RecentOrganization>) => {
      adapter.upsertOne(state, action.payload);
      // ids are sorted newest first: anything past the limit is the oldest.
      adapter.removeMany(state, state.ids.slice(RECENT_LIMIT));
    },
  },
});

export const { organizationViewed } = recentOrganizationsSlice.actions;

interface State {
  recentOrganizations: ReturnType<typeof recentOrganizationsSlice.reducer>;
}
const selectors = adapter.getSelectors((state: State) => state.recentOrganizations);

/** Memoised: the same array (and no re-render) until the slice changes. */
export const selectRecentOrganizations = createSelector([selectors.selectAll], (all) =>
  all.map(({ id, name, slug }) => ({ id, name, slug })),
);
