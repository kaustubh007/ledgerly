import { createHash } from 'node:crypto';
import type { Money } from '@ledgerly/domain';

// The port the application uses to take money. Production would implement it with a real
// gateway (Stripe, Adyen…); this project ships only PaymentGatewaySimulator (README, Simulations).

export interface ChargeRequest {
  readonly amount: Money;
  /** A payment method token issued by the gateway's client SDK, e.g. `pm_card_visa`. */
  readonly paymentMethod: string;
  /**
   * The gateway's own idempotency key. The same key with the same request returns the first
   * result without charging again, which is what makes retrying a charge safe.
   */
  readonly idempotencyKey: string;
  readonly description: string;
}

export type DeclineReason = 'card_declined' | 'insufficient_funds' | 'invalid_payment_method';

export type ChargeResult =
  | { readonly status: 'approved'; readonly chargeId: string }
  | { readonly status: 'declined'; readonly reason: DeclineReason };

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>;
  /** Refunds a charge in full. Refunding an already refunded charge is a no-op. */
  refund(chargeId: string): Promise<void>;
}

const DECLINE_MESSAGES: Readonly<Record<DeclineReason, string>> = {
  card_declined: 'The card was declined.',
  insufficient_funds: 'The card has insufficient funds.',
  invalid_payment_method: 'That payment method is not valid.',
};

export function declineMessage(reason: DeclineReason): string {
  return DECLINE_MESSAGES[reason];
}

/**
 * The gateway idempotency key for one of our requests. It includes a digest of what is being
 * charged, so the same client key with *different* charge parameters (a declined card, then a
 * different card, from the same form) is a different gateway request instead of a conflict,
 * while a true retry (same everything) still maps to the same gateway key and is charged once.
 */
export function gatewayKey(scope: string, key: string, ...charged: readonly string[]): string {
  const digest = createHash('sha256')
    .update(charged.join('\u0000'))
    .digest('base64url')
    .slice(0, 16);
  return `${scope}:${key}:${digest}`;
}

export class IdempotencyConflictError extends Error {
  constructor(key: string) {
    super(`Gateway idempotency key ${key} was reused with different parameters.`);
    this.name = 'IdempotencyConflictError';
  }
}
