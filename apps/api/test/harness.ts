import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair } from 'jose';
import { pino } from 'pino';
import type { Clock } from '../src/clock.ts';
import { loadConfig } from '../src/config.ts';
import { connect, disconnect, dropDatabase, syncIndexes } from '../src/data/connection.ts';
import type { Deps } from '../src/deps.ts';
import { importAccessTokenKeys } from '../src/features/identity/tokens.ts';
import { Outbox, type EmailTemplate } from '../src/features/outbox/outbox.ts';
import { CSRF_HEADER } from '../src/http/auth-routes.ts';
import { createApp, ORG_HEADER } from '../src/http/app.ts';

/** A clock tests can move. Starts at the real "now" so dates look normal in failures. */
export class TestClock implements Clock {
  private current = new Date();
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(date: Date): void {
    this.current = new Date(date);
  }
}

export interface TestApp {
  readonly url: string;
  readonly clock: TestClock;
  readonly deps: Deps;
  client(): Client;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export async function startTestApp(): Promise<TestApp> {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', { extractable: true });
  const config = loadConfig({
    NODE_ENV: 'test',
    MONGODB_URI: process.env['MONGODB_URI'],
    LOG_LEVEL: 'silent',
    ACCESS_TOKEN_PRIVATE_JWK: JSON.stringify(await exportJWK(privateKey)),
    ACCESS_TOKEN_PUBLIC_JWK: JSON.stringify(await exportJWK(publicKey)),
    REFRESH_GRACE_KEY: randomBytes(32).toString('base64url'),
    // One trusted hop, so tests can choose the client IP with X-Forwarded-For.
    TRUST_PROXY_HOPS: '1',
  });
  const clock = new TestClock();
  const deps: Deps = {
    config,
    clock,
    logger: pino({ level: process.env['TEST_LOG_LEVEL'] ?? 'silent' }),
    accessKeys: await importAccessTokenKeys(
      config.ACCESS_TOKEN_PRIVATE_JWK,
      config.ACCESS_TOKEN_PUBLIC_JWK,
    ),
    graceKey: Buffer.from(config.REFRESH_GRACE_KEY, 'base64url'),
  };

  await connect(config.MONGODB_URI);
  await syncIndexes();
  const { app, apollo } = await createApp(deps);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;

  let ipCounter = 0;
  return {
    url,
    clock,
    deps,
    // Each client looks like a different machine, so per-IP rate limits do not collide.
    client: () => new Client(url, `10.0.0.${String((ipCounter += 1) % 250)}`),
    reset: async () => {
      await dropDatabase();
      await syncIndexes();
    },
    close: async () => {
      await new Promise<void>((resolve) =>
        server.close(() => {
          resolve();
        }),
      );
      await apollo.stop();
      await disconnect();
    },
  };
}

interface StoredCookie {
  readonly value: string;
  readonly path: string;
}

export interface GraphQLResponse<T = Record<string, unknown>> {
  readonly status: number;
  readonly data?: T;
  readonly errors?: { message: string; extensions?: { code?: string; traceId?: string } }[];
}

/** A browser stand-in: a cookie jar that honours Path and Max-Age, and a selected org. */
export class Client {
  readonly cookies = new Map<string, StoredCookie>();
  org: string | undefined;

  private readonly baseUrl: string;
  readonly ip: string;

  constructor(baseUrl: string, ip: string) {
    this.baseUrl = baseUrl;
    this.ip = ip;
  }

  private cookieHeader(path: string): string {
    return [...this.cookies]
      .filter(
        ([, c]) => path === c.path || path.startsWith(c.path.endsWith('/') ? c.path : `${c.path}/`),
      )
      .map(([name, c]) => `${name}=${c.value}`)
      .join('; ');
  }

  private store(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const [pair = '', ...attributes] = header.split(';').map((s) => s.trim());
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq);
      const value = decodeURIComponent(pair.slice(eq + 1));
      const attrs = new Map(
        attributes.map((a) => {
          const [k = '', v = ''] = a.split('=');
          return [k.toLowerCase(), v];
        }),
      );
      const expired =
        attrs.get('max-age') === '0' ||
        (attrs.has('expires') && new Date(attrs.get('expires') ?? '') <= new Date());
      if (expired || value === '') this.cookies.delete(name);
      else this.cookies.set(name, { value, path: attrs.get('path') ?? '/' });
    }
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('x-forwarded-for', this.ip);
    const cookie = this.cookieHeader(path);
    if (cookie) headers.set('cookie', cookie);
    if (this.org && !headers.has(ORG_HEADER)) headers.set(ORG_HEADER, this.org);
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    this.store(response);
    return response;
  }

  async gql<T = Record<string, unknown>>(
    query: string,
    variables: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ): Promise<GraphQLResponse<T>> {
    const response = await this.request('/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await response.json()) as Omit<GraphQLResponse<T>, 'status'>;
    return { status: response.status, ...body };
  }

  /** Like gql, but fails the test on any GraphQL error and returns `data`. */
  async ok<T = Record<string, any>>(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    const res = await this.gql<T>(query, variables);
    if (res.errors?.length || !res.data)
      throw new Error(`GraphQL errors: ${JSON.stringify(res.errors)}`);
    return res.data;
  }

  async refresh(): Promise<Response> {
    return this.request('/graphql/auth/refresh', {
      method: 'POST',
      headers: { [CSRF_HEADER]: '1' },
    });
  }

  async logout(): Promise<Response> {
    return this.request('/graphql/auth/logout', {
      method: 'POST',
      headers: { [CSRF_HEADER]: '1' },
    });
  }
}

export const SIGN_UP = /* GraphQL */ `
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      viewer {
        id
        email
        memberships {
          role
          organization {
            id
            slug
            name
          }
        }
      }
      userErrors {
        code
        field
      }
    }
  }
`;

let userCounter = 0;

export interface SignedUp {
  readonly client: Client;
  readonly email: string;
  readonly password: string;
  readonly userId: string;
  readonly orgId: string;
  readonly orgSlug: string;
}

/** Signs up a fresh user with their own organisation and selects that organisation. */
export async function signUpUser(app: TestApp, name = 'User'): Promise<SignedUp> {
  userCounter += 1;
  const client = app.client();
  const email = `user${String(userCounter)}-${randomBytes(3).toString('hex')}@example.com`;
  const password = 'correct horse battery staple';
  const data = await client.ok<{
    signUp: {
      viewer: { id: string; memberships: { organization: { id: string; slug: string } }[] };
    };
  }>(SIGN_UP, { input: { email, password, name, organizationName: `${name} Org` } });
  const org = data.signUp.viewer.memberships[0]?.organization;
  if (!org) throw new Error('sign-up created no organisation');
  client.org = org.slug;
  return {
    client,
    email,
    password,
    userId: data.signUp.viewer.id,
    orgId: org.id,
    orgSlug: org.slug,
  };
}

/** The newest outbox email to `to`, optionally of one template. */
export async function lastEmail(
  to: string,
  template?: EmailTemplate,
): Promise<Record<string, string>> {
  const row = await Outbox.findOne({ to, ...(template ? { template } : {}) })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  if (!row) throw new Error(`No email to ${to}`);
  return row.data as Record<string, string>;
}

export function tokenFrom(link: string | undefined): string {
  const token = new URL(link ?? '').searchParams.get('token');
  if (!token) throw new Error(`No token in ${String(link)}`);
  return token;
}
