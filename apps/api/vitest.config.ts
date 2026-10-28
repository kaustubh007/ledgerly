import { baseConfig } from '@ledgerly/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
      // One real MongoDB replica set for the whole run; each test file gets its own database.
      globalSetup: ['test/global-setup.ts'],
      setupFiles: ['test/setup-env.ts'],
      testTimeout: 30_000,
      hookTimeout: 120_000,
      coverage: {
        exclude: [
          'src/**/*.test.ts',
          'src/graphql/__generated__/**',
          'src/main.ts',
          'src/instrumentation.ts',
          'src/scripts/**',
        ],
      },
    },
  }),
);
