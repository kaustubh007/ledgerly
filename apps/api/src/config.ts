import { z } from 'zod';

const Config = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** EdDSA (Ed25519) key pair for access tokens, as JWK JSON. `pnpm --filter @ledgerly/api keys`. */
  ACCESS_TOKEN_PRIVATE_JWK: z.string().min(1),
  ACCESS_TOKEN_PUBLIC_JWK: z.string().min(1),
  /** 32-byte base64url key that encrypts the refresh successor during the grace window. */
  REFRESH_GRACE_KEY: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'expected 32 bytes, base64url'),
  /** Origin the browser uses; links in emails are built from it. */
  PUBLIC_ORIGIN: z.url().default('http://localhost:3000'),
  /** Reverse proxies in front of the API (prod: CloudFront + ALB = 2). Decides `req.ip`. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  /** Per-IP request budget per minute, per API task (http/rate-limit.ts). */
  REQUESTS_PER_MINUTE_PER_IP: z.coerce.number().int().positive().default(1000),
});

export type Config = z.infer<typeof Config>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Config.safeParse(env);
  if (!parsed.success) {
    // Fail fast at boot with every problem listed, rather than at first use.
    throw new Error(`Invalid configuration:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
