import { ratio, type Ratio } from '../money/ratio.ts';
import { DomainError } from '../shared/domain-error.ts';

const SCALE = 1000n; // three decimal places: 1.5 hours, 0.125 kg
const MAX_THOUSANDTHS = 1_000_000_000n * SCALE;

export class InvalidQuantityError extends DomainError {
  readonly code = 'INVALID_QUANTITY';
  readonly input: string;

  constructor(input: string, reason: string) {
    super(`Invalid quantity ${JSON.stringify(input)}: ${reason}`);
    this.input = input;
  }
}

/** A positive line-item quantity with at most three decimal places, held as thousandths. */
export class Quantity {
  readonly thousandths: bigint;

  private constructor(thousandths: bigint) {
    if (thousandths <= 0n) throw new InvalidQuantityError(String(thousandths), 'must be positive');
    if (thousandths > MAX_THOUSANDTHS) {
      throw new InvalidQuantityError(String(thousandths), 'is too large');
    }
    this.thousandths = thousandths;
    Object.freeze(this);
  }

  static ofThousandths(thousandths: bigint): Quantity {
    return new Quantity(thousandths);
  }

  static parse(input: string): Quantity {
    const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(input);
    if (match === null) {
      throw new InvalidQuantityError(input, 'expected a decimal with at most 3 places');
    }
    const [, whole = '', fraction = ''] = match;
    return new Quantity(BigInt(whole + fraction.padEnd(3, '0')));
  }

  asRatio(): Ratio {
    return ratio(this.thousandths, SCALE);
  }

  toDecimalString(): string {
    const whole = this.thousandths / SCALE;
    const fraction = (this.thousandths % SCALE).toString().padStart(3, '0').replace(/0+$/, '');
    return fraction === '' ? whole.toString() : `${whole.toString()}.${fraction}`;
  }
}
