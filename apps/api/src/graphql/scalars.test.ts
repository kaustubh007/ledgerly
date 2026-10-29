import { Kind, type ValueNode } from 'graphql';
import { describe, expect, it } from 'vitest';
import { BigIntScalar, DateScalar, DateTimeScalar } from './scalars.ts';

const str = (value: string): ValueNode => ({ kind: Kind.STRING, value });
const int = (value: string): ValueNode => ({ kind: Kind.INT, value });

describe('BigInt', () => {
  it('serialises bigint as a string and parses integer strings', () => {
    expect(BigIntScalar.serialize(9007199254740993n)).toBe('9007199254740993');
    expect(BigIntScalar.parseValue('-12')).toBe(-12n);
    expect(BigIntScalar.parseLiteral(str('42'))).toBe(42n);
  });

  it('refuses anything that would lose precision or is not an integer', () => {
    expect(() => BigIntScalar.serialize(12)).toThrow(TypeError);
    expect(() => BigIntScalar.parseValue(12)).toThrow(/integer string/);
    expect(() => BigIntScalar.parseValue('1.5')).toThrow(/integer string/);
    expect(() => BigIntScalar.parseLiteral(int('12'))).toThrow(/integer string/);
    expect(() => BigIntScalar.parseLiteral(str('x'))).toThrow(/integer string/);
  });
});

describe('Date', () => {
  it('accepts real calendar dates only', () => {
    expect(DateScalar.parseValue('2028-02-29')).toBe('2028-02-29');
    expect(DateScalar.parseLiteral(str('2026-12-31'))).toBe('2026-12-31');
    expect(DateScalar.serialize('2026-01-01')).toBe('2026-01-01');
    expect(() => DateScalar.parseValue('2026-02-29')).toThrow(/not a calendar date/);
    expect(() => DateScalar.parseValue('2026-1-1')).toThrow(/YYYY-MM-DD/);
    expect(() => DateScalar.parseValue(20260101)).toThrow(/YYYY-MM-DD/);
    expect(() => DateScalar.parseLiteral(int('1'))).toThrow(/must be a string/);
  });
});

describe('DateTime', () => {
  it('serialises Date as ISO and parses ISO strings', () => {
    const d = new Date('2026-10-28T12:00:00.000Z');
    expect(DateTimeScalar.serialize(d)).toBe('2026-10-28T12:00:00.000Z');
    expect(DateTimeScalar.parseValue('2026-10-28T12:00:00Z')).toEqual(d);
    expect(DateTimeScalar.parseLiteral(str('2026-10-28T12:00:00Z'))).toEqual(d);
  });

  it('refuses invalid values', () => {
    expect(() => DateTimeScalar.serialize('2026-10-28')).toThrow(TypeError);
    expect(() => DateTimeScalar.parseValue('yesterday')).toThrow(/Invalid DateTime/);
    expect(() => DateTimeScalar.parseValue(5)).toThrow(/Invalid DateTime/);
    expect(() => DateTimeScalar.parseLiteral(int('5'))).toThrow(/Invalid DateTime/);
  });
});
