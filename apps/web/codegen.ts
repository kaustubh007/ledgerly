import type { CodegenConfig } from '@graphql-codegen/cli';

// Typed documents for the browser and RSC: write `graphql(`query ...`)` and get the result and
// variable types for free. Scalars arrive as JSON strings (BigInt, Date, DateTime).
const config: CodegenConfig = {
  schema: '../../packages/graphql/schema/tenant/*.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/graphql/__generated__/**'],
  ignoreNoDocuments: true,
  generates: {
    'src/graphql/__generated__/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false },
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        scalars: { BigInt: 'string', Date: 'string', DateTime: 'string', ID: 'string' },
      },
    },
  },
};

export default config;
