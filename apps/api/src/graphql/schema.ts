import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLFieldResolver, GraphQLSchema } from 'graphql';
import { currentContext } from '../context/request-context.ts';
import { billingResolvers } from '../features/billing/billing.resolvers.ts';
import { customersResolvers } from '../features/customers/customers.resolvers.ts';
import { identityResolvers } from '../features/identity/identity.resolvers.ts';
import { invoicesResolvers } from '../features/invoices/invoices.resolvers.ts';
import { organizationsResolvers } from '../features/organizations/organizations.resolvers.ts';
import { invoiceLineResolvers, moneyResolvers } from './money.ts';
import { orgSuspended } from './errors.ts';
import { BigIntScalar, DateScalar, DateTimeScalar } from './scalars.ts';

/**
 * Mutations about the caller's own account rather than an organisation. Everything else is a
 * tenant mutation, refused while the organisation is suspended (ADR-0004, E10-4).
 */
export const USER_SCOPED_MUTATIONS: ReadonlySet<string> = new Set([
  'signUp',
  'logIn',
  'verifyEmail',
  'requestPasswordReset',
  'resetPassword',
  'revokeSession',
  'revokeOtherSessions',
  'createOrganization',
  'acceptInvitation',
]);

/**
 * Wraps every tenant mutation so a suspended organisation is read-only. Done once on the built
 * schema, so a mutation added later is covered without anyone remembering to.
 */
function refuseWhileSuspended(schema: GraphQLSchema): GraphQLSchema {
  for (const [name, field] of Object.entries(schema.getMutationType()?.getFields() ?? {})) {
    if (USER_SCOPED_MUTATIONS.has(name)) continue;
    const resolve: GraphQLFieldResolver<unknown, unknown> | undefined = field.resolve;
    field.resolve = (source, args, context, info) => {
      if (currentContext()?.tenant?.suspended === true) throw orgSuspended();
      return resolve?.(source, args, context, info);
    };
  }
  return schema;
}

/** The SDL files of one schema in @ledgerly/graphql, concatenated. */
export function loadTypeDefs(name: 'tenant' | 'admin'): string {
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
  return refuseWhileSuspended(
    makeExecutableSchema({
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
    }),
  );
}
