import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript source, not dist, so tests never run against
// a stale build. The same condition is set in tsconfig.base.json.
//
// Vite resolves with different condition lists for client and server code, and setting a list
// *replaces* Vite's defaults, so both lists repeat the defaults (Vite 8: defaultClientConditions,
// defaultServerConditions). Vitest runs Node tests through the server ("ssr") resolver.
const SOURCE = '@ledgerly/source';

export const baseConfig = defineConfig({
  resolve: { conditions: [SOURCE, 'module', 'browser', 'development|production'] },
  ssr: { resolve: { conditions: [SOURCE, 'module', 'node', 'development|production'] } },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
