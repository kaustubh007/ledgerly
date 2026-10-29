import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** Where the API listens, from the web server's point of view (ADR-0001: never the browser's). */
const API = process.env['API_INTERNAL_URL'] ?? 'http://localhost:4000';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ADR-0001: in production CloudFront routes /graphql* to the API, so the browser sees one
  // origin. Locally these rewrites reproduce exactly that, cookies included.
  async rewrites() {
    return [
      { source: '/graphql', destination: `${API}/graphql` },
      { source: '/graphql/:path*', destination: `${API}/graphql/:path*` },
    ];
  },
};

export default withNextIntl(config);
