// Prints fresh development secrets in .env format. Production secrets live in Secrets Manager.
import { randomBytes } from 'node:crypto';
import { exportJWK, generateKeyPair } from 'jose';

const { privateKey, publicKey } = await generateKeyPair('EdDSA', { extractable: true });
console.log(`ACCESS_TOKEN_PRIVATE_JWK='${JSON.stringify(await exportJWK(privateKey))}'`);
console.log(`ACCESS_TOKEN_PUBLIC_JWK='${JSON.stringify(await exportJWK(publicKey))}'`);
console.log(`REFRESH_GRACE_KEY=${randomBytes(32).toString('base64url')}`);
