// Creates (or resets) a staff member for the admin console. There is no self sign-up.
//   pnpm --filter @ledgerly/api staff:create --email ops@ledgerly.example --name "Ops" --role OPS
// The password is read from STAFF_PASSWORD, or generated and printed once. The first sign-in
// enrols an authenticator app (TOTP is mandatory).
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { email as emailSchema, password as passwordSchema } from '@ledgerly/validation';
import { Staff } from '../admin/staff/staff.model.ts';
import { connect, disconnect, syncIndexes } from '../data/connection.ts';
import { hashPassword } from '../features/identity/passwords.ts';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'SUPPORT' },
    'reset-totp': { type: 'boolean', default: false },
  },
});

const email = emailSchema.parse(values.email);
const role = values.role === 'OPS' ? 'OPS' : 'SUPPORT';
const generated = process.env['STAFF_PASSWORD'] === undefined;
const password = passwordSchema.parse(
  process.env['STAFF_PASSWORD'] ?? randomBytes(18).toString('base64url'),
);

await connect(process.env['MONGODB_URI'] ?? '');
await syncIndexes();
const reset = values['reset-totp']
  ? { totpSecret: null, totpEnabledAt: null, totpLastStep: 0, recoveryCodeHashes: [] }
  : {};
await Staff.updateOne(
  { email },
  {
    $set: {
      name: values.name ?? email,
      role,
      passwordHash: await hashPassword(password),
      ...reset,
    },
    $setOnInsert: { email },
  },
  { upsert: true },
).exec();
await disconnect();

console.log(`Staff ${email} (${role}) is ready.`);
if (generated) console.log(`Password (shown once): ${password}`);
