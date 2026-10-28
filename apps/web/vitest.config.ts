import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { baseConfig } from '@ledgerly/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [react()],
    resolve: { alias: { '@web': fileURLToPath(new URL('./src', import.meta.url)) } },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      css: { modules: { classNameStrategy: 'non-scoped' } },
      coverage: {
        include: ['src/**/*.{ts,tsx}'],
        // Server Components and route files are covered by Playwright (RTL cannot render async
        // Server Components; PLAN §4).
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          'src/graphql/__generated__/**',
          'src/app/**',
          'src/**/*.d.ts',
        ],
      },
    },
  }),
);
