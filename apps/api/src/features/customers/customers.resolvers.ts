import { CustomerInput, parseInput } from '@ledgerly/validation';
import type { z } from 'zod';
import { requireTenant } from '../../graphql/context.ts';
import { objectId } from '../../graphql/ids.ts';
import {
  afterCursor,
  decodeCursor,
  NEWEST_FIRST,
  pageSize,
  toConnection,
} from '../../graphql/pagination.ts';
import type { Resolvers } from '../../graphql/__generated__/resolvers.ts';
import { Customer } from './customer.model.ts';

function customerFields(input: z.output<typeof CustomerInput>) {
  return {
    name: input.name,
    nameLower: input.name.toLowerCase(),
    email: input.email ?? null,
    defaultCurrency: input.defaultCurrency,
    documentLocale: input.documentLocale,
    billingAddress: input.billingAddress ?? null,
  };
}

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const customersResolvers: Resolvers = {
  Query: {
    customers: async (_, { first, after, search }) => {
      requireTenant('books:read');
      const size = pageSize(first);
      const cursor = after ? decodeCursor(after) : undefined;
      const filter: Record<string, unknown> = {
        ...(cursor ? afterCursor(cursor) : {}),
        ...(search?.trim()
          ? { nameLower: { $regex: `^${escapeRegex(search.trim().toLowerCase())}` } }
          : {}),
      };
      const rows = await Customer.find(filter)
        .sort(NEWEST_FIRST)
        .limit(size + 1)
        .lean()
        .exec();
      return toConnection(rows, size);
    },
    customer: async (_, { id }) => {
      requireTenant('books:read');
      const _id = objectId(id);
      return _id ? Customer.findById(_id).lean().exec() : null;
    },
  },
  Mutation: {
    createCustomer: async (_, { input }) => {
      requireTenant('customers:write');
      const parsed = parseInput(CustomerInput, input);
      if (!parsed.ok) return { customer: null, userErrors: parsed.userErrors };
      const customer = await new Customer(customerFields(parsed.value)).save();
      return { customer: customer.toObject(), userErrors: [] };
    },
    updateCustomer: async (_, { id, input }) => {
      requireTenant('customers:write');
      const parsed = parseInput(CustomerInput, input);
      if (!parsed.ok) return { customer: null, userErrors: parsed.userErrors };
      const _id = objectId(id);
      const customer = _id
        ? await Customer.findOneAndUpdate(
            { _id },
            { $set: customerFields(parsed.value) },
            { returnDocument: 'after', lean: true },
          )
        : null;
      return customer
        ? { customer, userErrors: [] }
        : {
            customer: null,
            userErrors: [{ code: 'NOT_FOUND', message: 'No such customer.', field: ['id'] }],
          };
    },
  },
  Customer: {
    id: (c) => c._id.toString(),
    name: (c) => c.name,
    email: (c) => c.email ?? null,
    defaultCurrency: (c) => c.defaultCurrency,
    documentLocale: (c) => c.documentLocale,
    billingAddress: (c) => c.billingAddress ?? null,
    createdAt: (c) => c.createdAt,
  },
};
