import { DomainError } from '../shared/domain-error.ts';

/** An exact fraction. Used to multiply `Money` without ever going through floating point. */
export interface Ratio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export class InvalidRatioError extends DomainError {
  readonly code = 'INVALID_RATIO';

  constructor() {
    super('A ratio denominator must be positive.');
  }
}

export function ratio(numerator: bigint, denominator: bigint): Ratio {
  if (denominator <= 0n) throw new InvalidRatioError();
  return Object.freeze({ numerator, denominator });
}

/**
 * Integer division rounded half-to-even ("banker's rounding"): ties go to the even neighbour,
 * so rounding errors do not drift in one direction across many line items.
 */
export function divideHalfEven(dividend: bigint, divisor: bigint): bigint {
  if (divisor <= 0n) throw new InvalidRatioError();
  const quotient = dividend / divisor; // BigInt division truncates toward zero
  const remainder = dividend % divisor; // and the remainder takes the dividend's sign
  if (remainder === 0n) return quotient;

  const awayFromZero = dividend < 0n ? quotient - 1n : quotient + 1n;
  const twiceRemainder = 2n * (remainder < 0n ? -remainder : remainder);
  if (twiceRemainder > divisor) return awayFromZero;
  if (twiceRemainder < divisor) return quotient;
  return quotient % 2n === 0n ? quotient : awayFromZero;
}
