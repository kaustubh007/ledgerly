import { defineConfig, devices } from '@playwright/test';

// End-to-end against the real stack: MongoDB from `make up`, the built API and `next start`,
// both started here, on a dedicated database emptied before the API boots
// (e2e/prepare-database.sh). A server that logs an error fails the run, even if every test
// passed (e2e/global-teardown.ts). Stop `make api` / `make web` first: they hold the ports.
const CI = Boolean(process.env['CI']);
const MONGODB_URI = 'mongodb://localhost:27017/ledgerly_e2e?replicaSet=rs0&directConnection=true';

export default defineConfig({
  testDir: 'e2e',
  globalTeardown: './e2e/global-teardown.ts',
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
      // Output is kept for global-teardown.ts, which fails the run if a server logged an error.
      command:
        '../web/e2e/prepare-database.sh && node --env-file=../../.env --import ./dist/instrumentation.js dist/main.js 2>&1 | tee ../../.e2e-logs/api.log',
      cwd: '../api',
      url: 'http://localhost:4000/healthz',
      reuseExistingServer: false,
      env: { TRUST_PROXY_HOPS: '1', MONGODB_URI },
    },
    {
      command: 'mkdir -p ../../.e2e-logs && pnpm start 2>&1 | tee ../../.e2e-logs/web.log',
      url: 'http://localhost:3000/en/sign-in',
      reuseExistingServer: false,
    },
  ],
});
