import {
  buildSchema,
  isInputObjectType,
  isNonNullType,
  type GraphQLInputObjectType,
} from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  AuditLogFilter,
  CardPaymentInput,
  ChangeOrganizationPlanInput,
  ChangePlanInput,
  CreateInvoiceInput,
  CustomerInput,
  InvoiceLineInput,
  LogInInput,
  MoneyInput,
  OrganizationActionInput,
  RecordPaymentInput,
  ResetPasswordInput,
  RevokeUserSessionsInput,
  SignUpInput,
  StaffSignInInput,
  VerifyMfaInput,
} from '@ledgerly/validation';
import type { z } from 'zod';
import { loadTypeDefs } from '../src/graphql/schema.ts';

// PLAN §3.4: GraphQL SDL and zod both describe inputs, and can drift. For every input type
// with a zod twin, the field names must match, and a field is required in GraphQL exactly when
// zod requires it.

const SCHEMAS = {
  tenant: buildSchema(loadTypeDefs('tenant')),
  admin: buildSchema(loadTypeDefs('admin')),
};

const TENANT_PAIRS: Record<string, z.ZodObject> = {
  SignUpInput,
  LogInInput,
  ResetPasswordInput,
  CustomerInput,
  InvoiceLineInput,
  CreateInvoiceInput,
  MoneyInput,
  RecordPaymentInput,
  CardPaymentInput,
  ChangePlanInput,
};

const ADMIN_PAIRS: Record<string, z.ZodObject> = {
  StaffSignInInput,
  VerifyMfaInput,
  OrganizationActionInput,
  ChangeOrganizationPlanInput,
  RevokeUserSessionsInput,
  AuditLogFilter,
};

const PAIRS = { tenant: TENANT_PAIRS, admin: ADMIN_PAIRS };

function graphqlShape(type: GraphQLInputObjectType) {
  return Object.fromEntries(
    Object.values(type.getFields()).map((f) => [f.name, isNonNullType(f.type)]),
  );
}

function zodShape(schema: z.ZodObject) {
  return Object.fromEntries(
    Object.entries(schema.shape).map(([name, field]) => [
      name,
      !(field as z.ZodType).safeParse(undefined).success,
    ]),
  );
}

describe.each(['tenant', 'admin'] as const)('zod ↔ GraphQL input contract (%s schema)', (name) => {
  const schema = SCHEMAS[name];
  const pairs = PAIRS[name];

  it.each(Object.keys(pairs))('%s matches', (type) => {
    const input = schema.getType(type);
    if (!isInputObjectType(input)) throw new Error(`${type} is not an input type`);
    const zod = pairs[type];
    if (!zod) throw new Error(`no zod schema for ${type}`);
    expect(zodShape(zod)).toEqual(graphqlShape(input));
  });

  it('every input type in the schema has a zod twin', () => {
    const inputs = Object.values(schema.getTypeMap())
      .filter(isInputObjectType)
      .map((t) => t.name);
    expect(inputs.filter((n) => !(n in pairs))).toEqual([]);
  });
});
