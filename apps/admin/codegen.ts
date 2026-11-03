import type { CodegenConfig } from '@graphql-codegen/cli';

// Typed documents for RTK Query. `documentMode: 'string'` makes each document a typed string, so
// the browser bundle needs no GraphQL parser: the base query just sends `String(document)`.
const config: CodegenConfig = {
  schema: '../../packages/graphql/schema/admin/*.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/graphql/__generated__/**'],
  ignoreNoDocuments: true,
  generates: {
    'src/graphql/__generated__/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false },
      config: {
        documentMode: 'string',
        useTypeImports: true,
        enumsAsTypes: true,
        scalars: { DateTime: 'string', ID: 'string' },
      },
    },
  },
};

export default config;
