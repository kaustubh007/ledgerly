import { CombinedGraphQLErrors } from '@apollo/client';
import { describe, expect, it } from 'vitest';
import { errorCodeOf } from './error-code';

const graphQLError = (code: string) =>
  new CombinedGraphQLErrors({ errors: [{ message: 'x', extensions: { code } }] });

describe('errorCodeOf', () => {
  it('passes through the codes forms explain', () => {
    expect(errorCodeOf(graphQLError('ORG_SUSPENDED'))).toBe('ORG_SUSPENDED');
    expect(errorCodeOf(graphQLError('FORBIDDEN'))).toBe('FORBIDDEN');
  });

  it('turns everything else into the generic message', () => {
    expect(errorCodeOf(graphQLError('INTERNAL_SERVER_ERROR'))).toBe('generic');
    expect(errorCodeOf(new TypeError('Failed to fetch'))).toBe('generic');
    expect(errorCodeOf(undefined)).toBe('generic');
  });
});
