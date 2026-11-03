import { describe, expect, it } from 'vitest';
import { safeNext } from '@admin/features/auth/safeNext';
import {
  organizationViewed,
  RECENT_LIMIT,
  selectRecentOrganizations,
} from './slices/recentOrganizations';
import { toastAdded, toastDismissed, selectToasts } from './slices/toasts';
import { makeStore } from './store';

const newStore = () => makeStore({ onSignedOut: () => undefined });

describe('recently viewed organisations (entity adapter)', () => {
  it('keeps the newest five, newest first, without duplicates', () => {
    const store = newStore();
    for (let i = 1; i <= 7; i += 1) {
      store.dispatch(
        organizationViewed({
          id: `o${String(i)}`,
          name: `Org ${String(i)}`,
          slug: `o${String(i)}`,
          viewedAt: i,
        }),
      );
    }
    store.dispatch(organizationViewed({ id: 'o4', name: 'Org 4', slug: 'o4', viewedAt: 99 }));
    const recent = selectRecentOrganizations(store.getState());
    expect(recent).toHaveLength(RECENT_LIMIT);
    expect(recent.map((o) => o.id)).toEqual(['o4', 'o7', 'o6', 'o5', 'o3']);
  });

  it('memoises: the same array until the slice changes', () => {
    const store = newStore();
    store.dispatch(organizationViewed({ id: 'a', name: 'A', slug: 'a', viewedAt: 1 }));
    const first = selectRecentOrganizations(store.getState());
    store.dispatch(toastAdded({ tone: 'info', message: 'unrelated' }));
    expect(selectRecentOrganizations(store.getState())).toBe(first);
  });
});

describe('toasts', () => {
  it('get ids from the action creator, so the reducer stays pure', () => {
    const store = newStore();
    store.dispatch(toastAdded({ tone: 'success', message: 'Saved' }));
    const [toast] = selectToasts(store.getState());
    expect(toast?.id).toEqual(expect.any(String));
    store.dispatch(toastDismissed(toast?.id ?? ''));
    expect(selectToasts(store.getState())).toEqual([]);
  });
});

describe('safeNext', () => {
  it.each([
    ['/audit', '/audit'],
    ['/organizations?q=a', '/organizations?q=a'],
    ['//evil.example', '/organizations'],
    ['/\\evil.example', '/organizations'],
    ['https://evil.example', '/organizations'],
    [null, '/organizations'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
