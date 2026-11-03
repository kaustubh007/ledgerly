import { createHmac } from 'node:crypto';

/** The admin console's preview server (apps/admin, `vite preview`), proxying /admin/graphql. */
export const ADMIN_URL = 'http://localhost:5173';

/** Created by prepare-database.sh before the API starts; enrols TOTP on first sign-in. */
export const STAFF = { email: 'e2e-ops@ledgerly.example', password: 'e2e staff password 1' };

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(text: string): Buffer {
  let bits = '';
  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const value = BASE32.indexOf(char);
    if (value < 0) throw new Error(`not base32: ${char}`);
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((byte) => parseInt(byte, 2)));
}

/**
 * The authenticator app: a TOTP code (RFC 6238, SHA-1, 6 digits, 30 s), from the setup key the
 * console shows. Written out with node:crypto so the E2E needs no extra dependency.
 */
export function totp(secret: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = (hmac.at(-1) ?? 0) & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}
