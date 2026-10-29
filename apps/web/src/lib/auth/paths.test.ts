import { describe, expect, it } from 'vitest';
import { safeNext, signInPath } from './paths';

describe('signInPath', () => {
  it('keeps the locale and comes back to the page', () => {
    expect(signInPath('/de/o/acme/customers')).toBe(
      '/de/sign-in?next=%2Fde%2Fo%2Facme%2Fcustomers',
    );
    expect(signInPath('/weird')).toBe('/en/sign-in?next=%2Fweird');
  });
});

describe('safeNext (no open redirect)', () => {
  it.each([
    ['/en/o/acme', '/en/o/acme'],
    [null, '/fallback'],
    ['https://evil.example', '/fallback'],
    ['//evil.example', '/fallback'],
    ['/\\evil.example', '/fallback'],
    ['javascript:alert(1)', '/fallback'],
  ])('%s → %s', (next, expected) => {
    expect(safeNext(next, '/fallback')).toBe(expected);
  });
});
