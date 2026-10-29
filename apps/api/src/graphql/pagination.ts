import { Types } from 'mongoose';

// Keyset pagination on (createdAt desc, _id desc). Unlike skip/limit it stays fast on deep
// pages and does not repeat or skip rows when new ones are inserted while paging.

export interface Cursor {
  readonly createdAt: Date;
  readonly id: Types.ObjectId;
}

export function encodeCursor(row: { createdAt: Date; _id: Types.ObjectId }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row._id.toString()}`).toString('base64url');
}

export function decodeCursor(cursor: string): Cursor | undefined {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  if (iso === undefined || id === undefined || !Types.ObjectId.isValid(id)) return undefined;
  const createdAt = new Date(iso);
  return Number.isNaN(createdAt.getTime()) ? undefined : { createdAt, id: new Types.ObjectId(id) };
}

export function afterCursor(cursor: Cursor): Record<string, unknown> {
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  };
}

export const NEWEST_FIRST = { createdAt: -1, _id: -1 } as const;

/** Clamps `first` and returns one extra row so `hasNextPage` needs no second query. */
export function pageSize(first: number | null | undefined): number {
  return Math.min(Math.max(first ?? 20, 1), 100);
}

export function toConnection<T extends { createdAt: Date; _id: Types.ObjectId }>(
  rows: T[],
  size: number,
) {
  const page = rows.slice(0, size);
  const last = page.at(-1);
  return {
    edges: page.map((node) => ({ cursor: encodeCursor(node), node })),
    pageInfo: { hasNextPage: rows.length > size, endCursor: last ? encodeCursor(last) : null },
  };
}
