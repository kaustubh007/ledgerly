import type { Logger } from 'pino';
import type { Clock } from './clock.ts';
import type { Config } from './config.ts';
import type { AccessTokenKeys } from './features/identity/tokens.ts';
import type { PaymentGateway } from './features/payments/gateway.ts';

/** Everything with configuration or side effects, built once in main.ts (or by a test). */
export interface Deps {
  readonly config: Config;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly accessKeys: AccessTokenKeys;
  /** Encrypts refresh successors during the grace window. */
  readonly graceKey: Buffer;
  /** Takes card payments: plan upgrades and invoice payments. PaymentGatewaySimulator here. */
  readonly paymentGateway: PaymentGateway;
}
