import { baseConfig } from '@ledgerly/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

// The domain is the one place where 100 % is the right number: it is small, pure, and every
// branch is a business rule.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: { thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 } },
    },
  }),
);
