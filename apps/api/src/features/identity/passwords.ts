import { hash, verify } from '@node-rs/argon2';

// argon2id with the OWASP Password Storage Cheat Sheet's first recommended configuration:
// 19 MiB memory, 2 iterations, 1 degree of parallelism.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

// Verified against when the email is unknown, so "no such user" costs the same time as "wrong
// password" and response timing does not reveal which emails have accounts.
const DUMMY_HASH = await hash('dummy password that never matches', OPTIONS);

export async function verifyPassword(
  passwordHash: string | undefined,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash ?? DUMMY_HASH, password);
  } catch {
    return false;
  }
}
