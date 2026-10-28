import type { Money } from '@ledgerly/domain';

/** What `CurrencyTotals` resolvers receive. Kept apart so generated types can import it without
 * an import cycle. */
export interface CurrencyTotalsParent {
  readonly currency: string;
  readonly outstanding: Money;
  readonly overdue: Money;
}
