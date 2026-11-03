import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

// findBy*/waitFor give up after 1 s by default. Lazy routes are compiled on first use, and under
// coverage with every package's suite running in parallel that can take longer; failing then
// would say nothing about the app.
configure({ asyncUtilTimeout: 10_000 });

/** One MSW server for the run; each test installs its own fake API with `server.use(...)`. */
export const server = setupServer();

// A request no handler answers fails the test instead of reaching the network.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
