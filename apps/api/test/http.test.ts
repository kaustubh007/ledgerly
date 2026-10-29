import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signUpUser, startTestApp, type TestApp } from './harness.ts';

let app: TestApp;
beforeAll(async () => {
  app = await startTestApp();
});
afterAll(() => app.close());

describe('HTTP and GraphQL hardening', () => {
  it('reports health', async () => {
    expect((await fetch(`${app.url}/healthz`)).status).toBe(200);
  });

  it('refuses requests a browser could send cross-site without a preflight (CSRF)', async () => {
    const textPlain = await fetch(`${app.url}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ query: '{ viewer { id } }' }),
    });
    expect(textPlain.status).toBe(400);
    const get = await fetch(`${app.url}/graphql?query=${encodeURIComponent('{ viewer { id } }')}`);
    expect(get.status).toBe(400);
  });

  it('limits aliases (alias batching, e.g. many login attempts in one request)', async () => {
    const many = Array.from({ length: 21 }, (_, i) => `a${String(i)}: viewer { id }`).join(' ');
    const res = await app.client().gql(`query { ${many} }`);
    expect(res.errors?.[0]?.message).toMatch(/21 aliases exceed the limit of 20/);
  });

  it('masks unexpected errors and returns a trace reference instead', async () => {
    const { client } = await signUpUser(app);
    // A malformed cursor is handled; force an internal error through a corrupt record instead.
    const { Invoice } = await import('../src/features/invoices/invoice.model.ts');
    const { runInTenant } = await import('../src/context/request-context.ts');
    const org = await client.ok<any>('query { organization { id } }');
    const { Types } = await import('mongoose');
    await runInTenant(org.organization.id, 'OWNER', async () => {
      await Invoice.create({
        customerId: new Types.ObjectId(), // a customer that does not exist
        status: 'DRAFT',
        currency: 'USD',
        dueDate: '2099-01-01',
        totalMinor: 0n,
        paidMinor: 0n,
      });
    });
    const res = await client.gql('query { invoices { edges { node { customer { name } } } } }');
    expect(res.errors?.[0]).toMatchObject({
      message: 'Something went wrong on our side.',
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
    expect(JSON.stringify(res.errors)).not.toMatch(/references a missing customer|stack/i);
  });
});
