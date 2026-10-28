import { randomUUID } from 'node:crypto';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { expressMiddleware } from '@as-integrations/express5';
import cookieParser from 'cookie-parser';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { runWithContext, type RequestContext } from '../context/request-context.ts';
import { isConnected } from '../data/connection.ts';
import type { Deps } from '../deps.ts';
import { authenticate } from '../features/identity/auth.service.ts';
import { ACCESS_COOKIE } from '../features/identity/cookies.ts';
import { resolveMembership } from '../features/organizations/organizations.service.ts';
import { createLoaders, type GraphQLContext } from '../graphql/context.ts';
import { createErrorFormatter } from '../graphql/errors.ts';
import { maxAliasesRule, maxDepthRule } from '../graphql/limits.ts';
import { buildTenantSchema } from '../graphql/schema.ts';
import { authRoutes } from './auth-routes.ts';

export const ORG_HEADER = 'x-org';

/**
 * Establishes who is calling and runs the rest of the request inside that context
 * (AsyncLocalStorage). Everything downstream — tenant guard, resolvers, logs — reads it.
 */
function requestContext(deps: Deps) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const base = {
      requestId: req.get('x-request-id') ?? randomUUID(),
      ip: req.ip ?? '',
      userAgent: req.get('user-agent'),
    };
    const token: unknown = (req.cookies as Record<string, unknown> | undefined)?.[ACCESS_COOKIE];
    const user = await authenticate(deps, typeof token === 'string' ? token : undefined);
    const slug = req.get(ORG_HEADER);
    const tenant = user && slug ? await resolveMembership(user.userId, slug) : undefined;

    const context: RequestContext = {
      ...base,
      ...(user ? { user } : {}),
      ...(tenant ? { tenant } : {}),
    };
    runWithContext(context, next);
  };
}

/** One structured line per request, inside the request context (so it carries requestId,
 * userId, orgId and traceId via the logger's mixin). */
function requestLog(deps: Deps) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const started = process.hrtime.bigint();
    // Captured now: mounted routers rewrite req.path ("/graphql" becomes "/").
    const path = req.originalUrl.split('?')[0];
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      deps.logger.info(
        { method: req.method, path, status: res.statusCode, ms: Math.round(ms) },
        'request',
      );
    });
    next();
  };
}

export interface App {
  readonly app: Express;
  readonly apollo: ApolloServer<GraphQLContext>;
}

export async function createApp(deps: Deps): Promise<App> {
  const production = deps.config.NODE_ENV === 'production';
  const apollo = new ApolloServer<GraphQLContext>({
    schema: buildTenantSchema(),
    // Refuses requests a browser could send cross-site without a preflight (PLAN §3.3).
    csrfPrevention: true,
    introspection: !production,
    validationRules: [maxDepthRule(12), maxAliasesRule(20)],
    formatError: createErrorFormatter(deps.logger),
    // Stack traces in error responses only outside production.
    includeStacktraceInErrorResponses: !production,
    plugins: production ? [ApolloServerPluginLandingPageDisabled()] : [],
  });
  await apollo.start();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', deps.config.TRUST_PROXY_HOPS);

  app.get('/healthz', (_req, res) => {
    const up = isConnected();
    res.status(up ? 200 : 503).json({ status: up ? 'ok' : 'unavailable' });
  });

  app.use(cookieParser(), express.json({ limit: '100kb' }), requestContext(deps), requestLog(deps));
  app.use('/graphql/auth', authRoutes(deps));
  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: ({ req, res }) => Promise.resolve({ deps, req, res, loaders: createLoaders() }),
    }),
  );

  // Express 5 forwards rejected promises here. Log with the request id; reveal nothing.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    deps.logger.error({ err: error }, 'unhandled HTTP error');
    if (!res.headersSent) res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  });

  return { app, apollo };
}
