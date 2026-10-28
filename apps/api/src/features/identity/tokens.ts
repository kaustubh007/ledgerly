import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { importJWK, jwtVerify, SignJWT, type CryptoKey, type JWK } from 'jose';
import type { Clock } from '../../clock.ts';

export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
const ISSUER = 'ledgerly';
const AUDIENCE = 'ledgerly-api';

export interface AccessTokenKeys {
  readonly privateKey: CryptoKey;
  readonly publicKey: CryptoKey;
}

export async function importAccessTokenKeys(
  privateJwk: string,
  publicJwk: string,
): Promise<AccessTokenKeys> {
  const [privateKey, publicKey] = await Promise.all([
    importJWK(JSON.parse(privateJwk) as JWK, 'EdDSA'),
    importJWK(JSON.parse(publicJwk) as JWK, 'EdDSA'),
  ]);
  if (!('type' in privateKey) || !('type' in publicKey))
    throw new Error('Expected asymmetric keys.');
  return { privateKey, publicKey };
}

/** Identity only (ADR-0003): roles are loaded per request, never trusted from the token. */
export interface AccessClaims {
  readonly userId: string;
  readonly sessionId: string;
}

export async function signAccessToken(
  claims: AccessClaims,
  keys: AccessTokenKeys,
  clock: Clock,
): Promise<string> {
  const now = Math.floor(clock.now().getTime() / 1000);
  return new SignJWT({ sid: claims.sessionId })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(keys.privateKey);
}

export async function verifyAccessToken(
  token: string,
  keys: AccessTokenKeys,
  clock: Clock,
): Promise<AccessClaims | undefined> {
  try {
    const { payload } = await jwtVerify(token, keys.publicKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['EdDSA'],
      currentDate: clock.now(),
    });
    const sid = payload['sid'];
    if (typeof payload.sub !== 'string' || typeof sid !== 'string') return undefined;
    return { userId: payload.sub, sessionId: sid };
  } catch {
    return undefined;
  }
}

/** 256 bits of randomness, URL-safe. Used for refresh tokens and one-time email tokens. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Tokens are stored only as hashes. SHA-256 is enough: the input is already 256 random bits. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/** AES-256-GCM, for keeping a refresh successor retrievable during the grace window only. */
export function sealToken(token: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString('base64url')).join('.');
}

export function openToken(sealed: string, key: Buffer): string | undefined {
  const [iv, tag, ciphertext] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !ciphertext) return undefined;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return undefined;
  }
}
