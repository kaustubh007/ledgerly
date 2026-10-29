import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLSchema } from 'graphql';
import { billingResolvers } from '../features/billing/billing.resolvers.ts';
import { customersResolvers } from '../features/customers/customers.resolvers.ts';
import { identityResolvers } from '../features/identity/identity.resolvers.ts';
import { invoicesResolvers } from '../features/invoices/invoices.resolvers.ts';
import { organizationsResolvers } from '../features/organizations/organizations.resolvers.ts';
import { invoiceLineResolvers, moneyResolvers } from './money.ts';
import { BigIntScalar, DateScalar, DateTimeScalar } from './scalars.ts';

/** The SDL files of one schema in @ledgerly/graphql, concatenated. */
export function loadTypeDefs(name: 'tenant'): string {
  const anchor = createRequire(import.meta.url).resolve(
    `@ledgerly/graphql/schema/${name}/root.graphql`,
  );
  const dir = dirname(anchor);
  return readdirSync(dir)
    .filter((file) => file.endsWith('.graphql'))
    .sort()
    .map((file) => readFileSync(join(dir, file), 'utf8'))
    .join('\n');
}

export function buildTenantSchema(): GraphQLSchema {
  return makeExecutableSchema({
    typeDefs: loadTypeDefs('tenant'),
    resolvers: [
      { BigInt: BigIntScalar, Date: DateScalar, DateTime: DateTimeScalar },
      { Money: moneyResolvers, InvoiceLine: invoiceLineResolvers },
      identityResolvers,
      organizationsResolvers,
      customersResolvers,
      invoicesResolvers,
      billingResolvers,
    ],
    // Fail at boot if a resolver names a field the schema does not have.
    resolverValidationOptions: { requireResolversToMatchSchema: 'error' },
  });
}
