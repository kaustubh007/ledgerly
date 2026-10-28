import {
  buildSchema,
  isInputObjectType,
  isNonNullType,
  type GraphQLInputObjectType,
} from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  CreateInvoiceInput,
  CustomerInput,
  InvoiceLineInput,
  LogInInput,
  MoneyInput,
  RecordPaymentInput,
  ResetPasswordInput,
  SignUpInput,
} from '@ledgerly/validation';
import type { z } from 'zod';
import { loadTypeDefs } from '../src/graphql/schema.ts';

// PLAN §3.4: GraphQL SDL and zod both describe inputs, and can drift. For every input type
// with a zod twin, the field names must match, and a field is required in GraphQL exactly when
// zod requires it.

const schema = buildSchema(loadTypeDefs('tenant'));

const PAIRS: Record<string, z.ZodObject> = {
  SignUpInput,
  LogInInput,
  ResetPasswordInput,
  CustomerInput,
  InvoiceLineInput,
  CreateInvoiceInput,
  MoneyInput,
  RecordPaymentInput,
};

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

describe('zod ↔ GraphQL input contract', () => {
  it.each(Object.keys(PAIRS))('%s matches', (name) => {
    const type = schema.getType(name);
    if (!isInputObjectType(type)) throw new Error(`${name} is not an input type`);
    const zod = PAIRS[name];
    if (!zod) throw new Error(`no zod schema for ${name}`);
    expect(zodShape(zod)).toEqual(graphqlShape(type));
  });

  it('every input type in the schema has a zod twin', () => {
    const inputs = Object.values(schema.getTypeMap())
      .filter(isInputObjectType)
      .map((t) => t.name);
    expect(inputs.filter((n) => !(n in PAIRS))).toEqual([]);
  });
});
