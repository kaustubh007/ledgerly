import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';

describe('formatMoney', () => {
  // Intl separates with no-break spaces (correct for display); compare with plain spaces.
  const plain = (s: string) => s.replace(/\s/gu, ' ');

  it('formats per locale and currency', () => {
    expect(formatMoney('1234.5', 'USD', 'en')).toBe('$1,234.50');
    expect(plain(formatMoney('1234.5', 'EUR', 'de'))).toBe('1.234,50 €');
    expect(formatMoney('1500', 'JPY', 'en')).toBe('¥1,500');
    expect(plain(formatMoney('7.000', 'KWD', 'en'))).toBe('KWD 7.000');
  });

  it('is exact beyond the range of a JS number', () => {
    expect(formatMoney('90071992547409931.23', 'USD', 'en')).toBe('$90,071,992,547,409,931.23');
  });
});
