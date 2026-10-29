import type { Clock } from '../../clock.ts';
import { todayIn } from '../../clock.ts';
import { money } from '../../graphql/money.ts';
import type { CurrencyTotalsParent } from './dashboard.types.ts';
import { Invoice } from './invoice.model.ts';

const OPEN = ['SENT', 'PARTIALLY_PAID'];

/**
 * Outstanding and overdue balance per currency. Grouping by currency is the point: amounts in
 * different currencies are never added together (CLAUDE.md). Runs through the tenant guard,
 * which prepends `$match: { orgId }`; the tenant-leak suite checks that.
 */
export async function currencyTotals(
  timeZone: string,
  clock: Clock,
): Promise<CurrencyTotalsParent[]> {
  const today = todayIn(timeZone, clock);
  const balance = { $subtract: ['$totalMinor', '$paidMinor'] };
  const rows = await Invoice.aggregate<{
    _id: string;
    outstanding: bigint | number;
    overdue: bigint | number;
  }>([
    { $match: { status: { $in: OPEN } } },
    {
      $group: {
        _id: '$currency',
        outstanding: { $sum: balance },
        // $toLong: keep the sum int64 even when every term is the int32 literal 0.
        overdue: { $sum: { $cond: [{ $lt: ['$dueDate', today] }, balance, { $toLong: 0 }] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((row) => ({
    currency: row._id,
    outstanding: money(BigInt(row.outstanding), row._id),
    overdue: money(BigInt(row.overdue), row._id),
  }));
}

export async function countsByStatus(): Promise<{ status: string; count: number }[]> {
  const rows = await Invoice.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((row) => ({ status: row._id, count: row.count }));
}
