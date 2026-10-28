import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, pageSize, toConnection } from './pagination.ts';

describe('cursors', () => {
  it('round-trip', () => {
    const row = { createdAt: new Date('2026-10-28T10:00:00Z'), _id: new Types.ObjectId() };
    expect(decodeCursor(encodeCursor(row))).toEqual({ createdAt: row.createdAt, id: row._id });
  });

  it.each([
    '',
    'garbage',
    Buffer.from('not-a-date|abc').toString('base64url'),
    Buffer.from('2026-01-01T00:00:00Z|xyz').toString('base64url'),
    Buffer.from('nodate').toString('base64url'),
  ])('treat %j as no cursor', (cursor) => {
    expect(decodeCursor(cursor)).toBeUndefined();
  });
});

describe('pageSize', () => {
  it.each([
    [undefined, 20],
    [null, 20],
    [0, 1],
    [-5, 1],
    [50, 50],
    [1000, 100],
  ])('%s → %i', (first, size) => {
    expect(pageSize(first)).toBe(size);
  });
});

describe('toConnection', () => {
  const rows = Array.from({ length: 3 }, (_, i) => ({
    createdAt: new Date(2026, 0, 3 - i),
    _id: new Types.ObjectId(),
  }));

  it('reports a next page when the extra row is present', () => {
    const page = toConnection(rows, 2);
    expect(page.edges).toHaveLength(2);
    expect(page.pageInfo).toEqual({ hasNextPage: true, endCursor: page.edges[1]?.cursor });
  });

  it('reports the end, and no cursor for an empty page', () => {
    expect(toConnection(rows, 3).pageInfo.hasNextPage).toBe(false);
    expect(toConnection([], 3).pageInfo).toEqual({ hasNextPage: false, endCursor: null });
  });
});
