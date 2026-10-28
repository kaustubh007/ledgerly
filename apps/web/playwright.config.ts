import { defineConfig, devices } from '@playwright/test';

// End-to-end against the real stack: MongoDB from `make up`, the built API and `next start`,
// both started here on a dedicated, freshly emptied database. Stop `make api` / `pnpm dev`
// first: reusing them would test whatever database and build they happen to have.
const CI = Boolean(process.env['CI']);
const MONGODB_URI = 'mongodb://localhost:27017/ledgerly_e2e?replicaSet=rs0&directConnection=true';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    // localhost, not 127.0.0.1: browsers treat it as a secure context, so the Secure and
    // __Host- cookies work over plain http in development.
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node --env-file=../../.env --import ./dist/instrumentation.js dist/main.js',
      cwd: '../api',
      url: 'http://localhost:4000/healthz',
      reuseExistingServer: false,
      env: { TRUST_PROXY_HOPS: '1', MONGODB_URI },
    },
    {
      command: 'pnpm start',
      url: 'http://localhost:3000/en/sign-in',
      reuseExistingServer: false,
    },
  ],
});
