import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLSchema } from 'graphql';
import { DateTimeScalar } from '../../graphql/scalars.ts';
import { loadTypeDefs } from '../../graphql/schema.ts';
import { adminResolvers } from './resolvers.ts';

/** The admin console's schema (ADR-0004). Shares no types with the tenant schema. */
export function buildAdminSchema(): GraphQLSchema {
  return makeExecutableSchema({
    typeDefs: loadTypeDefs('admin'),
    resolvers: [{ DateTime: DateTimeScalar }, adminResolvers],
    resolverValidationOptions: { requireResolversToMatchSchema: 'error' },
  });
}
