import { Types } from 'mongoose';
import { chargeForChange, planChange } from '@ledgerly/domain';
import { ChangePlanInput, parseInput, type UserError } from '@ledgerly/validation';
import type { Deps } from '../../deps.ts';
import { idempotent, storedOutcome, type Outcome } from '../idempotency/idempotency.ts';
import { Organization } from '../organizations/organization.model.ts';
import { declineMessage, gatewayKey } from '../payments/gateway.ts';
import { BillingEvent } from './billing-event.model.ts';
import { planCodeOf } from './limits.ts';

const refused = (code: string, message: string, field: string[] = []): Outcome => ({
  ok: false,
  userErrors: [{ code, message, field }] satisfies UserError[],
});

/**
 * Changes the context organisation's plan. Upgrades are charged first, through the gateway,
 * with an idempotency key derived from ours, so a retried request never charges twice.
 *
 * Order matters: (1) replay check, (2) charge — outside any database transaction, because a
 * transaction may be retried and a charge must not be, (3) record the change idempotently.
 */
export async function changePlan(
  deps: Deps,
  caller: { userId: string; orgId: string },
  rawInput: unknown,
  key: string,
): Promise<Outcome> {
  const replay = await storedOutcome('changePlan', key, caller.userId, rawInput);
  if (replay) return replay;

  const parsed = parseInput(ChangePlanInput, rawInput);
  if (!parsed.ok) return { ok: false, userErrors: parsed.userErrors };
  const target = parsed.value.plan;
  const current = await planCodeOf(caller.orgId);
  if (planChange(current, target) === 'SAME') {
    return refused('PLAN_UNCHANGED', `The organisation is already on ${target}.`, [
      'input',
      'plan',
    ]);
  }

  const amount = chargeForChange(current, target);
  let chargeId: string | null = null;
  if (amount.isPositive()) {
    const paymentMethod = parsed.value.paymentMethod;
    if (!paymentMethod) {
      return refused('PAYMENT_METHOD_REQUIRED', 'An upgrade needs a payment method.', [
        'input',
        'paymentMethod',
      ]);
    }
    const result = await deps.paymentGateway.charge({
      amount,
      paymentMethod,
      idempotencyKey: gatewayKey(`plan:${caller.orgId}`, key, target, paymentMethod),
      description: `Ledgerly ${target} plan, org ${caller.orgId}`,
    });
    if (result.status === 'declined') {
      return refused('CARD_DECLINED', declineMessage(result.reason), ['input', 'paymentMethod']);
    }
    chargeId = result.chargeId;
  }

  return idempotent('changePlan', key, caller.userId, rawInput, async () => {
    const now = deps.clock.now();
    await Organization.updateOne(
      { _id: caller.orgId },
      { plan: target, planChangedAt: now },
    ).exec();
    await BillingEvent.create([
      {
        type: 'PLAN_CHANGED',
        fromPlan: current,
        toPlan: target,
        amountMinor: amount.amountMinor,
        currency: amount.currency.code,
        chargeId,
        actorId: new Types.ObjectId(caller.userId),
      },
    ]);
    return { ok: true, id: caller.orgId };
  });
}
