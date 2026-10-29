import { randomBytes } from 'node:crypto';
import mongoose, { Schema } from 'mongoose';
import { isDuplicateKeyError } from '../../data/connection.ts';
import type { Clock } from '../../clock.ts';
import {
  IdempotencyConflictError,
  type ChargeRequest,
  type ChargeResult,
  type DeclineReason,
  type PaymentGateway,
} from './gateway.ts';

/**
 * A deliberate simulation of a card payment gateway (README, "Simulations"). It behaves like a
 * real one where it matters for this application:
 *
 * - test payment methods with fixed outcomes, in the style of Stripe's test cards;
 * - idempotency keys: a retried charge with the same key returns the first result and does not
 *   charge twice; the same key with different parameters is an error;
 * - refunds;
 * - state that survives restarts and is shared by every API task. It is stored in MongoDB, but
 *   conceptually it is the gateway's database, not ours: global, untouched by the tenant guard.
 */
export const TEST_PAYMENT_METHODS: Readonly<Record<string, DeclineReason | 'approved'>> = {
  pm_card_visa: 'approved',
  pm_card_mastercard: 'approved',
  pm_card_declined: 'card_declined',
  pm_card_insufficient_funds: 'insufficient_funds',
};

const chargeSchema = new Schema(
  {
    idempotencyKey: { type: String, required: true, unique: true },
    fingerprint: { type: String, required: true },
    status: { type: String, required: true, enum: ['approved', 'declined'] },
    reason: { type: String, default: null },
    chargeId: { type: String, default: null },
    amountMinor: { type: Schema.Types.BigInt, required: true },
    currency: { type: String, required: true },
    description: { type: String, required: true },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export const SimulatedCharge = mongoose.model('SimulatedCharge', chargeSchema);

export class PaymentGatewaySimulator implements PaymentGateway {
  private readonly clock: Clock;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const fingerprint = [
      request.amount.toString(),
      request.paymentMethod,
      request.description,
    ].join('|');
    const existing = await SimulatedCharge.findOne({ idempotencyKey: request.idempotencyKey })
      .lean()
      .exec();
    if (existing) return replay(existing, fingerprint, request.idempotencyKey);

    const outcome = TEST_PAYMENT_METHODS[request.paymentMethod] ?? 'invalid_payment_method';
    const approved = outcome === 'approved';
    try {
      await SimulatedCharge.create({
        idempotencyKey: request.idempotencyKey,
        fingerprint,
        status: approved ? 'approved' : 'declined',
        reason: approved ? null : outcome,
        chargeId: approved ? `ch_sim_${randomBytes(12).toString('hex')}` : null,
        amountMinor: request.amount.amountMinor,
        currency: request.amount.currency.code,
        description: request.description,
      });
    } catch (error) {
      // Two identical requests raced; the first one's result is the result.
      if (!isDuplicateKeyError(error)) throw error;
    }
    const stored = await SimulatedCharge.findOne({ idempotencyKey: request.idempotencyKey })
      .lean()
      .orFail()
      .exec();
    return replay(stored, fingerprint, request.idempotencyKey);
  }

  async refund(chargeId: string): Promise<void> {
    await SimulatedCharge.updateOne(
      { chargeId, refundedAt: null },
      { refundedAt: this.clock.now() },
    ).exec();
  }
}

function replay(
  stored: { fingerprint: string; status: string; chargeId?: string | null; reason?: string | null },
  fingerprint: string,
  key: string,
): ChargeResult {
  if (stored.fingerprint !== fingerprint) throw new IdempotencyConflictError(key);
  return stored.status === 'approved' && stored.chargeId
    ? { status: 'approved', chargeId: stored.chargeId }
    : { status: 'declined', reason: (stored.reason ?? 'card_declined') as DeclineReason };
}
