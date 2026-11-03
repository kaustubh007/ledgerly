import { CombinedGraphQLErrors } from '@apollo/client';

/** GraphQL error codes a form shows as such; anything else is the generic message. */
const SHOWN = new Set(['ORG_SUSPENDED', 'FORBIDDEN']);

/**
 * The code to show for a mutation that threw (a GraphQL error, not a `userError`): for example
 * ORG_SUSPENDED when Ledgerly staff suspended the organisation (ADR-0004). Network failures and
 * anything unexpected become `generic`.
 */
export function errorCodeOf(error: unknown): string {
  if (!CombinedGraphQLErrors.is(error)) return 'generic';
  const code = error.errors.map((e) => e.extensions?.['code']).find((c) => typeof c === 'string');
  return typeof code === 'string' && SHOWN.has(code) ? code : 'generic';
}
