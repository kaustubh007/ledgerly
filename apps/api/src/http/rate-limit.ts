import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Deps } from '../deps.ts';

const WINDOW_MS = 60_000;

/**
 * A per-IP flood guard in front of everything that costs a database round trip: every request
 * is authenticated (JWT check + session lookup) before any resolver runs. Counters live in
 * process memory, so the limit is per API task; the shared, edge-wide limit is a WAF rate rule
 * (Phase 8). Sign-in, sign-up and password reset keep their own stricter, Mongo-backed limits.
 */
export function requestRateLimit(deps: Deps): RateLimitRequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: deps.config.REQUESTS_PER_MINUTE_PER_IP,
    // `req.ip` honours `trust proxy` (TRUST_PROXY_HOPS); IPv6 clients are grouped by /56.
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      deps.logger.warn({ ip: req.ip, path: req.originalUrl.split('?')[0] }, 'rate limited');
      res.status(429).json({ error: 'RATE_LIMITED' });
    },
  });
}
