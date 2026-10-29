import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './harness.ts';

// A low budget so the limit is reachable; the default is in config.ts.
const LIMIT = 5;

let app: TestApp;
beforeAll(async () => {
  app = await startTestApp({ REQUESTS_PER_MINUTE_PER_IP: String(LIMIT) });
});
afterAll(() => app.close());

describe('per-IP request rate limit', () => {
  it('refuses requests over the budget before authenticating them, per client IP', async () => {
    const flooder = app.client();
    const statuses: number[] = [];
    for (let i = 0; i <= LIMIT; i += 1) {
      statuses.push((await flooder.gql('query { viewer { id } }')).status);
    }
    expect(statuses).toEqual([...Array<number>(LIMIT).fill(200), 429]);

    const refresh = await flooder.refresh();
    expect(refresh.status).toBe(429);
    expect(await refresh.json()).toEqual({ error: 'RATE_LIMITED' });

    // Another address is unaffected.
    expect((await app.client().gql('query { viewer { id } }')).status).toBe(200);
  });

  it('tells a limited client when to retry (standard headers)', async () => {
    const client = app.client();
    for (let i = 0; i < LIMIT; i += 1) await client.gql('query { viewer { id } }');
    const limited = await client.request('/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ viewer { id } }' }),
    });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(limited.headers.get('ratelimit-policy')).toMatch(/q=5; w=60/);
  });

  it('never limits the health check', async () => {
    for (let i = 0; i <= LIMIT; i += 1) {
      expect((await fetch(`${app.url}/healthz`)).status).toBe(200);
    }
  });
});
