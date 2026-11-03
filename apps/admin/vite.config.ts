import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The admin console is a static SPA. In production CloudFront serves it from S3 and routes
// /admin/graphql to the API on the same origin (ADR-0004); locally the dev and preview servers
// proxy it, so cookies are first-party in both.
const API = process.env['API_INTERNAL_URL'] ?? 'http://localhost:4000';
const proxy = { '/admin/graphql': { target: API, changeOrigin: false } };

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@admin': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 5173, strictPort: true, proxy },
  build: { sourcemap: true },
});
