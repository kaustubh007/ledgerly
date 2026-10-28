import { DomainError } from '../shared/domain-error.ts';
import { currency as currencyOf, type Currency } from './currency.ts';
import { divideHalfEven, type Ratio } from './ratio.ts';

// Money is stored in MongoDB as int64, so that is the legal range everywhere. BigInt itself
// never overflows; we enforce the storage range so a value that cannot be persisted can never
// be created.
const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;

export class CurrencyMismatchError extends DomainError {
  readonly code = 'CURRENCY_MISMATCH';
  readonly expected: string;
  readonly actual: string;

  constructor(expected: Currency, actual: Currency) {
    super(`Cannot combine ${expected.code} with ${actual.code}.`);
    this.expected = expected.code;
    this.actual = actual.code;
  }
}

export class MoneyOverflowError extends DomainError {
  readonly code = 'MONEY_OVERFLOW';

  constructor() {
    super('Amount is outside the int64 range of minor units.');
  }
}

export class InvalidMoneyFormatError extends DomainError {
  readonly code = 'INVALID_MONEY_FORMAT';
  readonly input: string;

  constructor(input: string, reason: string) {
    super(`Invalid amount ${JSON.stringify(input)}: ${reason}`);
    this.input = input;
  }
}

/** Wire format. `amountMinor` is a string because JSON numbers cannot carry int64 exactly. */
export interface MoneyJson {
  readonly amountMinor: string;
  readonly currency: string;
}

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

/**
 * An amount of one currency, held as an integer number of minor units (cents, fils, yen).
 *
 * - There is no conversion from or to a JS `number`: a float can't represent 0.10 exactly.
 * - Combining two currencies throws `CurrencyMismatchError`. There is no FX.
 * - The only rounding operation is `multiplyAndRound`, half-to-even.
 * - There is no division. Splitting an amount is an allocation problem, not a division.
 */
export class Money {
  readonly amountMinor: bigint;
  readonly currency: Currency;

  private constructor(amountMinor: bigint, currency: Currency) {
    if (amountMinor < INT64_MIN || amountMinor > INT64_MAX) throw new MoneyOverflowError();
    this.amountMinor = amountMinor;
    this.currency = currency;
    Object.freeze(this);
  }

  static of(amountMinor: bigint, currency: Currency): Money {
    return new Money(amountMinor, currency);
  }

  static zero(currency: Currency): Money {
    return new Money(0n, currency);
  }

  /**
   * Parses a plain decimal string such as `"12.30"` or `"-5"`. More fractional digits than
   * the currency has is an error, never a silent rounding.
   */
  static parse(input: string, currency: Currency): Money {
    const match = DECIMAL.exec(input);
    if (match === null) throw new InvalidMoneyFormatError(input, 'expected a plain decimal');
    const [, sign = '', whole = '', fraction = ''] = match;
    if (fraction.length > currency.minorUnits) {
      throw new InvalidMoneyFormatError(
        input,
        `${currency.code} has ${String(currency.minorUnits)} decimal places`,
      );
    }
    const minor = BigInt(whole + fraction.padEnd(currency.minorUnits, '0'));
    return new Money(sign === '-' ? -minor : minor, currency);
  }

  static fromJSON(json: MoneyJson): Money {
    if (!/^-?\d+$/.test(json.amountMinor)) {
      throw new InvalidMoneyFormatError(json.amountMinor, 'amountMinor must be an integer string');
    }
    return new Money(BigInt(json.amountMinor), currencyOf(json.currency));
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  negate(): Money {
    return new Money(-this.amountMinor, this.currency);
  }

  /** Multiplies by an exact fraction and rounds once, half-to-even, to a whole minor unit. */
  multiplyAndRound(factor: Ratio): Money {
    return new Money(
      divideHalfEven(this.amountMinor * factor.numerator, factor.denominator),
      this.currency,
    );
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.amountMinor < other.amountMinor) return -1;
    if (this.amountMinor > other.amountMinor) return 1;
    return 0;
  }

  /** Value equality. Unlike `compare`, different currencies are simply not equal. */
  equals(other: Money): boolean {
    return this.currency.code === other.currency.code && this.amountMinor === other.amountMinor;
  }

  isZero(): boolean {
    return this.amountMinor === 0n;
  }

  isPositive(): boolean {
    return this.amountMinor > 0n;
  }

  isNegative(): boolean {
    return this.amountMinor < 0n;
  }

  /** Exact decimal string, e.g. `"-12.30"`. Suitable for `Intl.NumberFormat#format`. */
  toDecimalString(): string {
    const negative = this.amountMinor < 0n;
    const digits = (negative ? -this.amountMinor : this.amountMinor).toString();
    const units = this.currency.minorUnits;
    const sign = negative ? '-' : '';
    if (units === 0) return sign + digits;
    const padded = digits.padStart(units + 1, '0');
    return `${sign}${padded.slice(0, -units)}.${padded.slice(-units)}`;
  }

  toJSON(): MoneyJson {
    return { amountMinor: this.amountMinor.toString(), currency: this.currency.code };
  }

  toString(): string {
    return `${this.toDecimalString()} ${this.currency.code}`;
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency.code !== this.currency.code) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}

/** Sums amounts that must all be in `currency`. An empty list sums to zero. */
export function sum(currency: Currency, amounts: Iterable<Money>): Money {
  let total = Money.zero(currency);
  for (const amount of amounts) total = total.add(amount);
  return total;
}
