import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Next.js 16 calls this file `proxy.ts` (formerly `middleware.ts`). For now it only negotiates
// the locale: `/` → `/en`. Authentication is *not* decided here: the refresh cookie is scoped to
// /graphql/auth (ADR-0005) and never reaches page requests, so only the app layout, which can
// fall back to a client-side refresh, can tell "signed out" from "access token expired".
export default createMiddleware(routing);

export const config = {
  // Everything except the API routes, Next internals and files with an extension.
  matcher: ['/((?!graphql|_next|_vercel|.*\\..*).*)'],
};
