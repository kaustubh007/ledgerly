import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { baseConfig } from '@ledgerly/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [react()],
    resolve: { alias: { '@admin': fileURLToPath(new URL('./src', import.meta.url)) } },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      // Whole sign-in flows through real routing and the store: slower than unit tests, more so
      // under coverage while the other packages' suites run in parallel.
      testTimeout: 20_000,
      css: { modules: { classNameStrategy: 'non-scoped' } },
      coverage: {
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          'src/graphql/__generated__/**',
          'src/main.tsx',
        ],
      },
    },
  }),
);
