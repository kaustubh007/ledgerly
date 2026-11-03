import { randomBytes } from 'node:crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import { Types } from 'mongoose';
import { parseInput, StaffSignInInput, VerifyMfaInput, type UserError } from '@ledgerly/validation';
import type { StaffRole } from '../../context/request-context.ts';
import type { Deps } from '../../deps.ts';
import { verifyPassword } from '../../features/identity/passwords.ts';
import { isRateLimited, LIMITS } from '../../features/identity/rate-limit.ts';
import { hashToken, openToken, randomToken, sealToken } from '../../features/identity/tokens.ts';
import { audit } from '../audit/audit.ts';
import { MfaChallenge, StaffSession } from './staff-session.model.ts';
import { Staff, type StaffRecord } from './staff.model.ts';

// Staff sign-in (ADR-0004): password, then a TOTP code, always. The first sign-in enrols the
// authenticator; there is no way to reach a session without one.

export const STAFF_SESSION_ABSOLUTE_MS = 8 * 60 * 60_000;
export const STAFF_SESSION_IDLE_MS = 30 * 60_000;
export const MFA_CHALLENGE_TTL_MS = 5 * 60_000;
const MFA_MAX_ATTEMPTS = 5;
/** Don't write `lastSeenAt` on every request; a minute's precision is plenty for a 30-min idle. */
const TOUCH_AFTER_MS = 60_000;
const TOTP_ISSUER = 'Ledgerly Admin';
/** One 30-second step either side, for clock drift between phone and server. */
const TOTP_TOLERANCE_SECONDS = 30;
const RECOVERY_CODES = 10;
const RECOVERY_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'; // no 0/o, 1/l/i

interface ClientMeta {
  readonly ip: string;
  readonly userAgent: string | undefined;
}

const refusal = (code: string, message: string, field: string[] = []): UserError[] => [
  { code, message, field },
];

const INVALID_CREDENTIALS = refusal('INVALID_CREDENTIALS', 'Wrong email or password.');
const RATE_LIMITED = refusal('RATE_LIMITED', 'Too many attempts. Try again in 15 minutes.');
const CHALLENGE_EXPIRED = refusal(
  'MFA_EXPIRED',
  'This sign-in has expired. Enter your email and password again.',
);
const INVALID_CODE = refusal('INVALID_CODE', 'That code is not valid.', ['input', 'code']);

export type SignInResult =
  | { readonly kind: 'refused'; readonly userErrors: UserError[] }
  | {
      readonly kind: 'challenge';
      readonly challengeToken: string;
      readonly next: 'ENROL' | 'VERIFY';
      readonly enrolment: { readonly secret: string; readonly otpauthUri: string } | null;
    };

export async function signIn(
  deps: Deps,
  rawInput: unknown,
  meta: ClientMeta,
): Promise<SignInResult> {
  const parsed = parseInput(StaffSignInInput, rawInput);
  if (!parsed.ok) return { kind: 'refused', userErrors: parsed.userErrors };
  const { email, password } = parsed.value;

  const [byEmail, byIp] = await Promise.all([
    isRateLimited(`staff-signin:${email}`, LIMITS.staffSignInPerEmail, deps.clock),
    isRateLimited(`staff-signin-ip:${meta.ip}`, LIMITS.staffSignInPerIp, deps.clock),
  ]);
  if (byEmail || byIp) return { kind: 'refused', userErrors: RATE_LIMITED };

  const staff = await Staff.findOne({ email }).lean().exec();
  // Always verify, even for unknown emails, so timing doesn't reveal which accounts exist.
  const passwordOk = await verifyPassword(staff?.passwordHash, password);
  if (!staff || !passwordOk || staff.disabledAt) {
    await audit({ action: 'staff.signIn.failed', staffId: staff?._id ?? null, details: { email } });
    return { kind: 'refused', userErrors: INVALID_CREDENTIALS };
  }

  const enrolling = staff.totpEnabledAt == null;
  const secret = enrolling ? generateSecret() : null;
  const challengeToken = randomToken();
  await MfaChallenge.create({
    staffId: staff._id,
    tokenHash: hashToken(challengeToken),
    pendingTotpSecret: secret ? sealToken(secret, deps.totpKey) : null,
    expiresAt: new Date(deps.clock.now().getTime() + MFA_CHALLENGE_TTL_MS),
  });
  await audit({
    action: 'staff.signIn.password',
    staffId: staff._id,
    details: { next: enrolling ? 'ENROL' : 'VERIFY' },
  });
  return {
    kind: 'challenge',
    challengeToken,
    next: enrolling ? 'ENROL' : 'VERIFY',
    enrolment: secret
      ? { secret, otpauthUri: generateURI({ issuer: TOTP_ISSUER, label: staff.email, secret }) }
      : null,
  };
}

export type VerifyMfaResult =
  | { readonly kind: 'refused'; readonly userErrors: UserError[] }
  | {
      readonly kind: 'ok';
      readonly staff: StaffRecord;
      readonly sessionToken: string;
      /** Shown once, at enrolment. */
      readonly recoveryCodes: readonly string[] | null;
    };

export async function verifyMfa(
  deps: Deps,
  challengeToken: string | undefined,
  rawInput: unknown,
  meta: ClientMeta,
): Promise<VerifyMfaResult> {
  const parsed = parseInput(VerifyMfaInput, rawInput);
  if (!parsed.ok) return { kind: 'refused', userErrors: parsed.userErrors };
  if (!challengeToken) return { kind: 'refused', userErrors: CHALLENGE_EXPIRED };
  const now = deps.clock.now();

  // Counting the attempt and checking the limit in one atomic update: parallel guesses can't
  // exceed the budget.
  const challenge = await MfaChallenge.findOneAndUpdate(
    {
      tokenHash: hashToken(challengeToken),
      usedAt: null,
      expiresAt: { $gt: now },
      attempts: { $lt: MFA_MAX_ATTEMPTS },
    },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after', lean: true },
  ).exec();
  if (!challenge) return { kind: 'refused', userErrors: CHALLENGE_EXPIRED };
  const staff = await Staff.findById(challenge.staffId).lean().exec();
  if (!staff || staff.disabledAt) return { kind: 'refused', userErrors: CHALLENGE_EXPIRED };

  // Every rejected code is audited against the staff member it was for.
  const mfaFailed = async (): Promise<VerifyMfaResult> => {
    await audit({ action: 'staff.mfa.failed', staffId: staff._id });
    return { kind: 'refused', userErrors: INVALID_CODE };
  };
  const { code } = parsed.value;
  const enrolling = challenge.pendingTotpSecret != null;
  let method: 'totp' | 'recovery';
  let recoveryCodes: string[] | null = null;

  if (/^\d{6}$/.test(code)) {
    const sealed = challenge.pendingTotpSecret ?? staff.totpSecret;
    const secret = sealed ? openToken(sealed, deps.totpKey) : undefined;
    if (!secret) return mfaFailed();
    const result = await verify({
      secret,
      token: code,
      epoch: Math.floor(now.getTime() / 1000),
      epochTolerance: TOTP_TOLERANCE_SECONDS,
      afterTimeStep: staff.totpLastStep,
    });
    // otplib's result type also covers HOTP; a TOTP result always carries its time step.
    if (!result.valid || !('timeStep' in result)) return mfaFailed();
    // Replay protection: the step only moves forward, atomically, so a code is accepted once
    // even by two requests racing with it.
    const update: Record<string, unknown> = { totpLastStep: result.timeStep };
    if (enrolling) {
      recoveryCodes = Array.from({ length: RECOVERY_CODES }, newRecoveryCode);
      update['totpSecret'] = challenge.pendingTotpSecret;
      update['totpEnabledAt'] = now;
      update['recoveryCodeHashes'] = recoveryCodes.map(hashToken);
    }
    const moved = await Staff.updateOne(
      { _id: staff._id, totpLastStep: { $lt: result.timeStep } },
      { $set: update },
    ).exec();
    if (moved.modifiedCount !== 1) return mfaFailed();
    method = 'totp';
  } else {
    // A recovery code proves possession of a code printed at enrolment; it can't enrol.
    if (enrolling) return mfaFailed();
    const used = await Staff.updateOne(
      { _id: staff._id, recoveryCodeHashes: hashToken(code) },
      { $pull: { recoveryCodeHashes: hashToken(code) } },
    ).exec();
    if (used.modifiedCount !== 1) return mfaFailed();
    method = 'recovery';
  }

  await MfaChallenge.updateOne({ _id: challenge._id }, { usedAt: now }).exec();
  const sessionToken = randomToken();
  await StaffSession.create({
    staffId: staff._id,
    tokenHash: hashToken(sessionToken),
    expiresAt: new Date(now.getTime() + STAFF_SESSION_ABSOLUTE_MS),
    lastSeenAt: now,
    ip: meta.ip,
    userAgent: meta.userAgent ?? null,
  });
  await audit({
    action: enrolling ? 'staff.mfa.enrolled' : 'staff.signIn',
    staffId: staff._id,
    details: { method },
  });
  return { kind: 'ok', staff, sessionToken, recoveryCodes };
}

function newRecoveryCode(): string {
  const chars = [...randomBytes(8)].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

export interface StaffIdentity {
  readonly staffId: string;
  readonly sessionId: string;
  readonly role: StaffRole;
}

/**
 * The staff member behind a session cookie, or undefined. Checked on every admin request: an
 * expired, idle, revoked or disabled session is refused at once. Role is read now, never cached.
 */
export async function authenticateStaff(
  deps: Deps,
  sessionToken: string | undefined,
): Promise<StaffIdentity | undefined> {
  if (!sessionToken) return undefined;
  const now = deps.clock.now();
  const session = await StaffSession.findOne({
    tokenHash: hashToken(sessionToken),
    revokedAt: null,
    expiresAt: { $gt: now },
    lastSeenAt: { $gt: new Date(now.getTime() - STAFF_SESSION_IDLE_MS) },
  })
    .lean()
    .exec();
  if (!session) return undefined;
  const staff = await Staff.findOne({ _id: session.staffId, disabledAt: null }, { role: 1 })
    .lean()
    .exec();
  if (!staff) return undefined;
  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    await StaffSession.updateOne({ _id: session._id }, { lastSeenAt: now }).exec();
  }
  return { staffId: staff._id.toString(), sessionId: session._id.toString(), role: staff.role };
}

export async function signOut(deps: Deps, sessionId: string): Promise<void> {
  await StaffSession.updateOne(
    { _id: new Types.ObjectId(sessionId), revokedAt: null },
    { revokedAt: deps.clock.now() },
  ).exec();
}
