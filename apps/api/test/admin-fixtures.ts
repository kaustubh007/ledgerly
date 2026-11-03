import { randomBytes } from 'node:crypto';
import { generate } from 'otplib';
import { Staff } from '../src/admin/staff/staff.model.ts';
import { hashPassword } from '../src/features/identity/passwords.ts';
import type { Client, TestApp } from './harness.ts';

export const SIGN_IN = /* GraphQL */ `
  mutation ($input: StaffSignInInput!) {
    signIn(input: $input) {
      next
      enrolment {
        secret
        otpauthUri
      }
      userErrors {
        code
        field
      }
    }
  }
`;

export const VERIFY_MFA = /* GraphQL */ `
  mutation ($code: String!) {
    verifyMfa(input: { code: $code }) {
      staff {
        id
        email
        role
      }
      recoveryCodes
      userErrors {
        code
        field
      }
    }
  }
`;

export const ME = 'query { me { id email role } }';

const PASSWORD = 'staff password long enough';
let staffCounter = 0;

export interface SignedInStaff {
  readonly client: Client;
  readonly staffId: string;
  readonly email: string;
  readonly password: string;
  readonly secret: string;
  readonly recoveryCodes: readonly string[];
}

export async function createStaff(
  role: 'SUPPORT' | 'OPS',
): Promise<{ email: string; password: string }> {
  staffCounter += 1;
  const email = `staff${String(staffCounter)}-${randomBytes(3).toString('hex')}@ledgerly.example`;
  await Staff.create({
    email,
    name: `Staff ${String(staffCounter)}`,
    role,
    passwordHash: await hashPassword(PASSWORD),
  });
  return { email, password: PASSWORD };
}

/** The authenticator app: the TOTP code for `secret` at the test clock's current time. */
export function totp(app: TestApp, secret: string): Promise<string> {
  return generate({ secret, epoch: Math.floor(app.clock.now().getTime() / 1000) });
}

/**
 * A staff member through the whole first sign-in: password, enrolment, first code. Moves the
 * test clock on by one TOTP step afterwards, so the next code is not a replay.
 */
export async function signInStaff(app: TestApp, role: 'SUPPORT' | 'OPS'): Promise<SignedInStaff> {
  const { email, password } = await createStaff(role);
  const client = app.client();
  const step1 = await client.adminOk(SIGN_IN, { input: { email, password } });
  const secret: string = step1.signIn.enrolment.secret;
  const step2 = await client.adminOk(VERIFY_MFA, { code: await totp(app, secret) });
  if (step2.verifyMfa.userErrors.length)
    throw new Error(JSON.stringify(step2.verifyMfa.userErrors));
  app.clock.advance(30_000);
  return {
    client,
    staffId: step2.verifyMfa.staff.id,
    email,
    password,
    secret,
    recoveryCodes: step2.verifyMfa.recoveryCodes,
  };
}
