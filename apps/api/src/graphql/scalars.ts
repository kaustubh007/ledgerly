import { GraphQLError, GraphQLScalarType, Kind } from 'graphql';

const invalid = (message: string): GraphQLError =>
  new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });

export const BigIntScalar = new GraphQLScalarType<bigint, string>({
  name: 'BigInt',
  serialize(value) {
    if (typeof value !== 'bigint') throw new TypeError('BigInt fields must resolve to a bigint.');
    return value.toString();
  },
  parseValue(value) {
    if (typeof value !== 'string' || !/^-?\d+$/.test(value)) {
      throw invalid('BigInt must be an integer string.');
    }
    return BigInt(value);
  },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING || !/^-?\d+$/.test(ast.value)) {
      throw invalid('BigInt must be an integer string.');
    }
    return BigInt(ast.value);
  },
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: unknown): string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) throw invalid('Date must be YYYY-MM-DD.');
  // Round-trip through UTC to refuse impossible dates such as 2026-02-30.
  if (new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw invalid(`${value} is not a calendar date.`);
  }
  return value;
}

export const DateScalar = new GraphQLScalarType<string, string>({
  name: 'Date',
  serialize: (value) => parseDate(value),
  parseValue: parseDate,
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) throw invalid('Date must be a string.');
    return parseDate(ast.value);
  },
});

export const DateTimeScalar = new GraphQLScalarType<Date, string>({
  name: 'DateTime',
  serialize(value) {
    if (!(value instanceof Date)) throw new TypeError('DateTime fields must resolve to a Date.');
    return value.toISOString();
  },
  parseValue(value) {
    const date = typeof value === 'string' ? new Date(value) : undefined;
    if (date === undefined || Number.isNaN(date.getTime())) throw invalid('Invalid DateTime.');
    return date;
  },
  parseLiteral(ast) {
    const date = ast.kind === Kind.STRING ? new Date(ast.value) : undefined;
    if (date === undefined || Number.isNaN(date.getTime())) throw invalid('Invalid DateTime.');
    return date;
  },
});
