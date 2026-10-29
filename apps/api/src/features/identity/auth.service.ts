import { Types } from 'mongoose';
import {
  LogInInput,
  parseInput,
  ResetPasswordInput,
  SignUpInput,
  type UserError,
} from '@ledgerly/validation';
import { inTransaction, isDuplicateKeyError } from '../../data/connection.ts';
import type { Deps } from '../../deps.ts';
import { createOrganization } from '../organizations/organizations.service.ts';
import { enqueueEmail } from '../outbox/outbox.ts';
import { SESSION_TTL_MS } from './cookies.ts';
import { OneTimeToken } from './one-time-token.model.ts';
import { hashPassword, verifyPassword } from './passwords.ts';
import { isRateLimited, LIMITS } from './rate-limit.ts';
import { Session } from './session.model.ts';
import {
  hashToken,
  openToken,
  randomToken,
  sealToken,
  signAccessToken,
  verifyAccessToken,
  type AccessClaims,
} from './tokens.ts';
import { User } from './user.model.ts';

/** ADR-0003: a rotated refresh token presented again within this window gets the same successor. */
export const REFRESH_GRACE_MS = 20_000;
const RETIRED_HASHES_KEPT = 20;
const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000;

export interface ClientMeta {
  readonly ip: string;
  readonly userAgent: string | undefined;
}

export interface IssuedSession {
  readonly userId: string;
  readonly sessionId: string;
  readonly access: string;
  readonly refresh: string;
}

export type AuthOutcome =
  | ({ readonly ok: true } & IssuedSession)
  | { readonly ok: false; readonly userErrors: UserError[] };

const refusal = (code: string, message: string, field: string[] = []): AuthOutcome => ({
  ok: false,
  userErrors: [{ code, message, field }],
});

const RATE_LIMITED = refusal('RATE_LIMITED', 'Too many attempts. Try again later.');

async function startSession(
  deps: Deps,
  userId: Types.ObjectId,
  meta: ClientMeta,
): Promise<IssuedSession> {
  const now = deps.clock.now();
  const refresh = randomToken();
  const [session] = await Session.create([
    {
      userId,
      refreshHash: hashToken(refresh),
      userAgent: meta.userAgent ?? null,
      ip: meta.ip,
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    },
  ]);
  if (!session) throw new Error('Session.create returned nothing.');
  const claims = { userId: userId.toString(), sessionId: session._id.toString() };
  return { ...claims, refresh, access: await signAccessToken(claims, deps.accessKeys, deps.clock) };
}

async function issueEmailToken(
  deps: Deps,
  purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
  userId: Types.ObjectId,
  ttlMs: number,
): Promise<string> {
  const token = randomToken();
  await OneTimeToken.create([
    {
      purpose,
      hash: hashToken(token),
      userId,
      expiresAt: new Date(deps.clock.now().getTime() + ttlMs),
    },
  ]);
  return token;
}

export async function signUp(
  deps: Deps,
  rawInput: unknown,
  meta: ClientMeta,
): Promise<AuthOutcome> {
  const parsed = parseInput(SignUpInput, rawInput);
  if (!parsed.ok) return { ok: false, userErrors: parsed.userErrors };
  if (await isRateLimited(`signup:ip:${meta.ip}`, LIMITS.signUpPerIp, deps.clock))
    return RATE_LIMITED;

  const input = parsed.value;
  // Hash outside the transaction: it is slow on purpose and the transaction may be retried.
  const passwordHash = await hashPassword(input.password);
  try {
    return await inTransaction(async () => {
      if (await User.exists({ email: input.email })) {
        return refusal('EMAIL_TAKEN', 'An account with this email already exists.', [
          'input',
          'email',
        ]);
      }
      const [user] = await User.create([{ email: input.email, name: input.name, passwordHash }]);
      if (!user) throw new Error('User.create returned nothing.');
      await createOrganization(user._id, input.organizationName);
      const token = await issueEmailToken(deps, 'VERIFY_EMAIL', user._id, VERIFY_EMAIL_TTL_MS);
      await enqueueEmail('verify-email', user.email, {
        name: user.name,
        link: `${deps.config.PUBLIC_ORIGIN}/verify-email?token=${token}`,
      });
      return { ok: true, ...(await startSession(deps, user._id, meta)) };
    });
  } catch (error) {
    // Two sign-ups with the same email at once: the unique index decides.
    if (isDuplicateKeyError(error)) {
      return refusal('EMAIL_TAKEN', 'An account with this email already exists.', [
        'input',
        'email',
      ]);
    }
    throw error;
  }
}

export async function logIn(deps: Deps, rawInput: unknown, meta: ClientMeta): Promise<AuthOutcome> {
  const parsed = parseInput(LogInInput, rawInput);
  if (!parsed.ok) return { ok: false, userErrors: parsed.userErrors };
  const { email, password } = parsed.value;

  const [byEmail, byIp] = await Promise.all([
    isRateLimited(`login:email:${email}`, LIMITS.loginPerEmail, deps.clock),
    isRateLimited(`login:ip:${meta.ip}`, LIMITS.loginPerIp, deps.clock),
  ]);
  if (byEmail || byIp) return RATE_LIMITED;

  const user = await User.findOne({ email }, { passwordHash: 1 }).lean().exec();
  // Always verify, even with no user, so timing does not reveal whether the email exists.
  const valid = await verifyPassword(user?.passwordHash, password);
  if (!user || !valid) return refusal('INVALID_CREDENTIALS', 'Email or password is incorrect.');
  return { ok: true, ...(await startSession(deps, user._id, meta)) };
}

export type RefreshOutcome =
  | ({ readonly kind: 'ok' } & IssuedSession)
  | { readonly kind: 'reuse' }
  | { readonly kind: 'invalid' };

/**
 * Rotates a refresh token (ADR-0003):
 * - current token → new token; the old one becomes `previous`, with its successor sealed;
 * - `previous` within the grace window → the same successor (racing tabs both succeed);
 * - `previous` after the window, or any older token → reuse: the whole session is revoked.
 */
export async function refresh(
  deps: Deps,
  token: string,
  meta: ClientMeta,
): Promise<RefreshOutcome> {
  const now = deps.clock.now();
  const hash = hashToken(token);
  const live = { revokedAt: null, expiresAt: { $gt: now } };

  const next = randomToken();
  const rotated = await Session.findOneAndUpdate(
    { refreshHash: hash, ...live },
    [
      {
        $set: {
          // The token that was `previous` until now is retired; keep the last few for detection.
          retiredHashes: {
            $slice: [
              {
                $concatArrays: [
                  '$retiredHashes',
                  { $cond: [{ $ifNull: ['$previous.hash', false] }, ['$previous.hash'], []] },
                ],
              },
              -RETIRED_HASHES_KEPT,
            ],
          },
          // $literal: values in a pipeline stage are expressions; a string starting with "$"
          // would be read as a field path. Ours never do, but data is not code.
          previous: {
            $literal: { hash, rotatedAt: now, successor: sealToken(next, deps.graceKey) },
          },
          refreshHash: { $literal: hashToken(next) },
          lastUsedAt: now,
          ip: { $literal: meta.ip },
        },
      },
    ],
    { returnDocument: 'after', lean: true, updatePipeline: true },
  );
  if (rotated) return issue(deps, rotated.userId, rotated._id, next);

  const raced = await Session.findOne({ 'previous.hash': hash, ...live })
    .lean()
    .exec();
  if (raced?.previous) {
    const age = now.getTime() - raced.previous.rotatedAt.getTime();
    const successor = openToken(raced.previous.successor, deps.graceKey);
    // Only hand out the successor while it is still the session's current token.
    if (
      age <= REFRESH_GRACE_MS &&
      successor !== undefined &&
      hashToken(successor) === raced.refreshHash
    ) {
      return issue(deps, raced.userId, raced._id, successor);
    }
    if (age > REFRESH_GRACE_MS) return revokeForReuse(deps, raced._id);
    return { kind: 'invalid' };
  }

  const reused = await Session.findOne({ retiredHashes: hash, revokedAt: null }, { _id: 1 })
    .lean()
    .exec();
  if (reused) return revokeForReuse(deps, reused._id);
  return { kind: 'invalid' };
}

async function issue(
  deps: Deps,
  userId: Types.ObjectId,
  sessionId: Types.ObjectId,
  refreshToken: string,
): Promise<RefreshOutcome> {
  const claims = { userId: userId.toString(), sessionId: sessionId.toString() };
  const access = await signAccessToken(claims, deps.accessKeys, deps.clock);
  return { kind: 'ok', ...claims, access, refresh: refreshToken };
}

async function revokeForReuse(deps: Deps, sessionId: Types.ObjectId): Promise<RefreshOutcome> {
  await Session.updateOne(
    { _id: sessionId, revokedAt: null },
    { revokedAt: deps.clock.now(), revokedReason: 'REFRESH_TOKEN_REUSE' },
  );
  deps.logger.warn({ sessionId: sessionId.toString() }, 'refresh token reuse: session revoked');
  return { kind: 'reuse' };
}

/** Verifies the access token *and* that its session is still live, so revocation is immediate. */
export async function authenticate(
  deps: Deps,
  accessToken: string | undefined,
): Promise<AccessClaims | undefined> {
  if (accessToken === undefined) return undefined;
  const claims = await verifyAccessToken(accessToken, deps.accessKeys, deps.clock);
  if (!claims || !Types.ObjectId.isValid(claims.sessionId)) return undefined;
  const live = await Session.exists({
    _id: claims.sessionId,
    userId: claims.userId,
    revokedAt: null,
    expiresAt: { $gt: deps.clock.now() },
  });
  return live ? claims : undefined;
}

export async function revokeSessionByRefreshToken(deps: Deps, token: string): Promise<void> {
  await Session.updateOne(
    { refreshHash: hashToken(token), revokedAt: null },
    { revokedAt: deps.clock.now(), revokedReason: 'LOGOUT' },
  );
}

export async function revokeSession(
  deps: Deps,
  userId: string,
  sessionId: string,
  reason: string,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(sessionId)) return false;
  const result = await Session.updateOne(
    { _id: sessionId, userId, revokedAt: null },
    { revokedAt: deps.clock.now(), revokedReason: reason },
  );
  return result.modifiedCount === 1;
}

export async function revokeOtherSessions(
  deps: Deps,
  userId: string,
  keepSessionId: string,
): Promise<void> {
  await Session.updateMany(
    { userId, _id: { $ne: keepSessionId }, revokedAt: null },
    { revokedAt: deps.clock.now(), revokedReason: 'SIGNED_OUT_ELSEWHERE' },
  );
}

/** Marks a one-time token used and returns it, or undefined if unknown, used or expired. */
async function consumeToken(deps: Deps, purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD', token: string) {
  return OneTimeToken.findOneAndUpdate(
    { purpose, hash: hashToken(token), usedAt: null, expiresAt: { $gt: deps.clock.now() } },
    { usedAt: deps.clock.now() },
    { returnDocument: 'after', lean: true },
  );
}

export async function verifyEmail(deps: Deps, token: string): Promise<UserError[]> {
  const used = await consumeToken(deps, 'VERIFY_EMAIL', token);
  if (!used?.userId)
    return [
      { code: 'INVALID_TOKEN', message: 'This link is invalid or has expired.', field: ['token'] },
    ];
  await User.updateOne(
    { _id: used.userId, emailVerifiedAt: null },
    { emailVerifiedAt: deps.clock.now() },
  );
  return [];
}

/** Always "succeeds", so the response never reveals whether an account exists. */
export async function requestPasswordReset(deps: Deps, rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (await isRateLimited(`reset:email:${email}`, LIMITS.passwordResetPerEmail, deps.clock)) return;
  const user = await User.findOne({ email }, { name: 1, email: 1 }).lean().exec();
  if (!user) return;
  await inTransaction(async () => {
    const token = await issueEmailToken(deps, 'RESET_PASSWORD', user._id, RESET_PASSWORD_TTL_MS);
    await enqueueEmail('reset-password', user.email, {
      name: user.name,
      link: `${deps.config.PUBLIC_ORIGIN}/reset-password?token=${token}`,
    });
  });
}

export async function resetPassword(deps: Deps, rawInput: unknown): Promise<UserError[]> {
  const parsed = parseInput(ResetPasswordInput, rawInput);
  if (!parsed.ok) return parsed.userErrors;
  const passwordHash = await hashPassword(parsed.value.password);
  return inTransaction(async () => {
    const used = await consumeToken(deps, 'RESET_PASSWORD', parsed.value.token);
    if (!used?.userId) {
      return [
        {
          code: 'INVALID_TOKEN',
          message: 'This link is invalid or has expired.',
          field: ['input', 'token'],
        },
      ];
    }
    await User.updateOne({ _id: used.userId }, { passwordHash });
    // Whoever knew the old password may still hold a session; end them all.
    await Session.updateMany(
      { userId: used.userId, revokedAt: null },
      { revokedAt: deps.clock.now(), revokedReason: 'PASSWORD_RESET' },
    );
    return [];
  });
}
