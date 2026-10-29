import { unwrapResolverError } from '@apollo/server/errors';
import type { GraphQLFormattedError } from 'graphql';
import { GraphQLError } from 'graphql';
import type { Logger } from 'pino';
import { trace } from '@opentelemetry/api';

// GraphQL errors are for "you can't ask that": not signed in, not allowed, malformed request.
// Business refusals are `userErrors` in the payload (PLAN §3.3).

export function unauthenticated(): GraphQLError {
  return new GraphQLError('Sign in to continue.', { extensions: { code: 'UNAUTHENTICATED' } });
}

export function forbidden(message = 'You do not have access to this.'): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'FORBIDDEN' } });
}

/** Codes whose message is safe to show to the client as-is. */
const PUBLIC_CODES = new Set([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'BAD_USER_INPUT',
  'GRAPHQL_PARSE_FAILED',
  'GRAPHQL_VALIDATION_FAILED',
  'PERSISTED_QUERY_NOT_FOUND',
  'PERSISTED_QUERY_NOT_SUPPORTED',
  'OPERATION_RESOLUTION_FAILURE',
  'BAD_REQUEST',
]);

/**
 * Anything unexpected is logged in full and replaced with a generic message carrying the trace
 * id, so a user report can be matched to the trace without leaking internals.
 */
export function createErrorFormatter(logger: Logger) {
  return (formatted: GraphQLFormattedError, error: unknown): GraphQLFormattedError => {
    const code = formatted.extensions?.['code'];
    if (typeof code === 'string' && PUBLIC_CODES.has(code)) return formatted;

    const traceId = trace.getActiveSpan()?.spanContext().traceId;
    logger.error(
      { err: unwrapResolverError(error), path: formatted.path },
      'unhandled resolver error',
    );
    return {
      message: 'Something went wrong on our side.',
      ...(formatted.path ? { path: formatted.path } : {}),
      extensions: { code: 'INTERNAL_SERVER_ERROR', ...(traceId ? { traceId } : {}) },
    };
  };
}
