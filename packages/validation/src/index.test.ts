import { describe, expect, it } from 'vitest';
import {
  CreateInvoiceInput,
  CustomerInput,
  InviteMemberInput,
  parseInput,
  SignUpInput,
} from './index.ts';

const codes = (r: ReturnType<typeof parseInput>) => (r.ok ? [] : r.userErrors.map((e) => e.code));
const fields = (r: ReturnType<typeof parseInput>) =>
  r.ok ? [] : r.userErrors.map((e) => e.field.join('.'));

describe('SignUpInput', () => {
  const valid = {
    email: '  Ada@Example.COM ',
    password: 'correct horse battery',
    name: ' Ada ',
    organizationName: 'Analytical Engines',
  };

  it('normalises email and trims names', () => {
    const r = parseInput(SignUpInput, valid);
    expect(r.ok && r.value).toMatchObject({ email: 'ada@example.com', name: 'Ada' });
  });

  it('reports every problem with a stable code and a field path', () => {
    const r = parseInput(SignUpInput, { ...valid, email: 'nope', password: 'short', name: ' ' });
    expect(codes(r)).toEqual(['INVALID_EMAIL', 'TOO_SMALL', 'TOO_SMALL']);
    expect(fields(r)).toEqual(['input.email', 'input.password', 'input.name']);
  });
});

describe('CustomerInput', () => {
  const valid = { name: 'Acme', defaultCurrency: 'EUR', documentLocale: 'de-DE' };

  it('accepts optional fields as null or absent', () => {
    expect(parseInput(CustomerInput, valid).ok).toBe(true);
    expect(parseInput(CustomerInput, { ...valid, email: null, billingAddress: null }).ok).toBe(
      true,
    );
  });

  it('refuses unsupported currencies and malformed locales', () => {
    const r = parseInput(CustomerInput, {
      ...valid,
      defaultCurrency: 'BTC',
      documentLocale: 'de_DE!',
    });
    expect(codes(r)).toEqual(['UNSUPPORTED_CURRENCY', 'INVALID_LOCALE']);
  });
});

describe('CreateInvoiceInput', () => {
  const valid = {
    customerId: 'c1',
    currency: 'USD',
    dueDate: '2026-11-30',
    lines: [{ description: 'Work', quantity: '1.5', unitPrice: '120.00' }],
  };

  it('accepts a valid invoice', () => {
    expect(parseInput(CreateInvoiceInput, valid).ok).toBe(true);
  });

  it('refuses impossible dates, bad quantities and bad amounts, pointing at the line', () => {
    const r = parseInput(CreateInvoiceInput, {
      ...valid,
      dueDate: '2026-02-30',
      lines: [{ description: 'Work', quantity: '1.2345', unitPrice: '-1' }],
    });
    expect(codes(r)).toEqual(['INVALID_DATE', 'INVALID_QUANTITY', 'INVALID_AMOUNT']);
    expect(fields(r)).toEqual([
      'input.dueDate',
      'input.lines.0.quantity',
      'input.lines.0.unitPrice',
    ]);
  });
});

describe('InviteMemberInput', () => {
  it('refuses unknown roles', () => {
    const r = parseInput(InviteMemberInput, { email: 'a@b.co', role: 'GOD' }, []);
    expect(codes(r)).toEqual(['INVALID_ROLE']);
    expect(fields(r)).toEqual(['role']);
  });
});
