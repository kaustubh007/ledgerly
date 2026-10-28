import { DomainError } from '../shared/domain-error.ts';

/** An ISO 4217 currency and the number of digits after its decimal point. */
export interface Currency {
  readonly code: string;
  readonly minorUnits: number;
}

// Deliberately a short allowlist, not all of ISO 4217: every currency here has been checked
// for its minor-unit count, and the 0- and 3-digit cases are covered by tests.
export type CurrencyCode =
  | 'AED'
  | 'AUD'
  | 'BHD'
  | 'CAD'
  | 'CHF'
  | 'EUR'
  | 'GBP'
  | 'INR'
  | 'JPY'
  | 'KRW'
  | 'KWD'
  | 'SAR'
  | 'SGD'
  | 'USD';

const MINOR_UNITS: Readonly<Record<CurrencyCode, number>> = {
  AED: 2,
  AUD: 2,
  BHD: 3,
  CAD: 2,
  CHF: 2,
  EUR: 2,
  GBP: 2,
  INR: 2,
  JPY: 0,
  KRW: 0,
  KWD: 3,
  SAR: 2,
  SGD: 2,
  USD: 2,
};

const CURRENCIES: ReadonlyMap<string, Currency> = new Map(
  Object.entries(MINOR_UNITS).map(([code, minorUnits]) => [
    code,
    Object.freeze({ code, minorUnits }),
  ]),
);

export class UnknownCurrencyError extends DomainError {
  readonly code = 'UNKNOWN_CURRENCY';
  readonly currencyCode: string;

  constructor(currencyCode: string) {
    super(`Unsupported currency: ${JSON.stringify(currencyCode)}`);
    this.currencyCode = currencyCode;
  }
}

/** Returns the canonical `Currency` for a code. The same object is returned for the same code. */
export function currency(code: string): Currency {
  const found = CURRENCIES.get(code);
  if (found === undefined) throw new UnknownCurrencyError(code);
  return found;
}

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return CURRENCIES.has(code);
}

export function supportedCurrencies(): readonly Currency[] {
  return [...CURRENCIES.values()];
}
