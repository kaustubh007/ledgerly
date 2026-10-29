import {
  isPlanCode,
  isRole,
  isSupportedCurrency,
  type PlanCode,
  type Role,
} from '@ledgerly/domain';
import { z } from 'zod';

// Field-level rules only: shape is the GraphQL schema's job, business rules are the domain's.
// Messages are English fallbacks; clients translate by `code` (see toUserErrors).

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

/** A refinement that carries a stable error code, so clients never parse English messages. */
const matching = (pattern: RegExp, code: string, message: string) =>
  z.string().refine((value) => pattern.test(value), { message, params: { code } });

export const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** NIST SP 800-63B: length over composition rules. 12 is our floor; 128 caps hashing cost. */
export const password = z.string().min(12).max(128);

export const currencyCode = z.string().refine(isSupportedCurrency, {
  message: 'Unsupported currency',
  params: { code: 'UNSUPPORTED_CURRENCY' },
});

export const locale = z.string().refine(
  (value) => {
    try {
      return Intl.getCanonicalLocales(value).length === 1;
    } catch {
      return false;
    }
  },
  { message: 'Not a valid BCP 47 locale', params: { code: 'INVALID_LOCALE' } },
);

export const role = z.string().refine((value): value is Role => isRole(value), {
  message: 'Unknown role',
  params: { code: 'INVALID_ROLE' },
});

/** A real calendar date: `2026-02-30` is refused, not rolled over to March. */
export const isoDate = z.iso.date();

export const decimalAmount = matching(
  /^\d+(\.\d+)?$/,
  'INVALID_AMOUNT',
  'Expected a plain decimal such as 12.30',
);

export const quantity = matching(
  /^\d+(\.\d{1,3})?$/,
  'INVALID_QUANTITY',
  'Expected a decimal with at most three places',
);

export const SignUpInput = z.object({
  email,
  password,
  name: trimmed(1, 100),
  organizationName: trimmed(2, 80),
});

export const LogInInput = z.object({ email, password: z.string().min(1).max(128) });

export const ResetPasswordInput = z.object({ token: z.string().min(1), password });

export const CustomerInput = z.object({
  name: trimmed(1, 200),
  email: email.nullish(),
  defaultCurrency: currencyCode,
  documentLocale: locale,
  billingAddress: trimmed(0, 500).nullish(),
});

export const InvoiceLineInput = z.object({
  description: trimmed(1, 500),
  quantity,
  unitPrice: decimalAmount,
});

export const CreateInvoiceInput = z.object({
  customerId: z.string().min(1),
  currency: currencyCode,
  dueDate: isoDate,
  lines: z.array(InvoiceLineInput).max(200),
});

export const InvoiceLines = z.array(InvoiceLineInput).max(200);

export const MoneyInput = z.object({ amount: decimalAmount, currency: currencyCode });

export const RecordPaymentInput = z.object({ invoiceId: z.string().min(1), amount: MoneyInput });

export const CardPaymentInput = z.object({
  invoiceId: z.string().min(1),
  amount: MoneyInput,
  paymentMethod: z.string().trim().min(1).max(100),
});

export const InviteMemberInput = z.object({ email, role });

export const planCode = z.string().refine((value): value is PlanCode => isPlanCode(value), {
  message: 'Unknown plan',
  params: { code: 'INVALID_PLAN' },
});

export const ChangePlanInput = z.object({
  plan: planCode,
  paymentMethod: z.string().trim().min(1).max(100).nullish(),
});

export const OrganizationName = trimmed(2, 80);

export interface UserError {
  readonly code: string;
  readonly message: string;
  readonly field: readonly string[];
}

/** Turns a zod error into GraphQL `UserError`s. `prefix` is prepended to every field path. */
export function toUserErrors(error: z.ZodError, prefix: readonly string[] = []): UserError[] {
  return error.issues.map((issue) => {
    const custom =
      issue.code === 'custom' ? (issue.params as { code?: string } | undefined)?.code : undefined;
    const fromFormat =
      issue.code === 'invalid_format' ? `INVALID_${issue.format.toUpperCase()}` : undefined;
    return {
      code: custom ?? fromFormat ?? issue.code.toUpperCase(),
      message: issue.message,
      field: [...prefix, ...issue.path.map(String)],
    };
  });
}

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly userErrors: UserError[] };

export function parseInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
  prefix: readonly string[] = ['input'],
): ParseResult<z.output<S>> {
  const result = schema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, userErrors: toUserErrors(result.error, prefix) };
}
