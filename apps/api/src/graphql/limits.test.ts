import { buildSchema, parse, specifiedRules, validate } from 'graphql';
import { describe, expect, it } from 'vitest';
import { maxAliasesRule, maxDepthRule } from './limits.ts';

// A recursive schema, so arbitrarily deep queries are possible (ours is not recursive today;
// the rule is there for the day it becomes so).
const schema = buildSchema(`
  type Node { id: ID! child: Node }
  type Query { node: Node }
`);

const errorsOf = (query: string) =>
  validate(schema, parse(query), [...specifiedRules, maxDepthRule(3), maxAliasesRule(2)]).map(
    (e) => e.message,
  );

describe('maxDepthRule', () => {
  it('allows queries up to the limit and refuses deeper ones', () => {
    expect(errorsOf('{ node { child { id } } }')).toEqual([]);
    expect(errorsOf('{ node { child { child { id } } } }')).toEqual([
      'Query depth 4 exceeds the limit of 3.',
    ]);
  });

  it('follows fragments and inline fragments', () => {
    const viaFragment =
      'query { node { ...A } } fragment A on Node { child { ...B } } fragment B on Node { child { id } }';
    expect(errorsOf(viaFragment)).toEqual(['Query depth 4 exceeds the limit of 3.']);
    const inline = '{ node { ... on Node { child { ... on Node { child { id } } } } } }';
    expect(errorsOf(inline)).toEqual(['Query depth 4 exceeds the limit of 3.']);
  });

  it('does not loop on fragment cycles (GraphQL reports the cycle itself)', () => {
    const cyclic = 'query { node { ...A } } fragment A on Node { child { ...A } }';
    expect(errorsOf(cyclic).some((m) => m.includes('Cannot spread fragment'))).toBe(true);
  });
});

describe('maxAliasesRule', () => {
  it('counts aliases across the document', () => {
    expect(errorsOf('{ a: node { id } b: node { id } }')).toEqual([]);
    expect(errorsOf('{ a: node { id } b: node { id } c: node { x: id } }')).toEqual([
      '4 aliases exceed the limit of 2.',
    ]);
  });
});
