/**
 * Formats an exact decimal amount (the API's `Money.amount`, e.g. "1234.50") for a locale.
 * Intl.NumberFormat accepts decimal strings and formats them without converting to a float;
 * the DOM lib typings only declare number | bigint, hence the cast.
 */
export function formatMoney(amount: string, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    amount as unknown as number,
  );
}
