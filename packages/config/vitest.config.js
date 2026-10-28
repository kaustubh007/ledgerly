import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript source, not dist, so tests never run
// against a stale build. The same condition is set in tsconfig.base.json.
export const baseConfig = defineConfig({
  resolve: { conditions: ['@ledgerly/source'] },
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
