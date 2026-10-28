import { createConfig } from '@ledgerly/config/eslint';

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  { ignores: ['src/graphql/__generated__/**'] },
  {
    // GraphQL responses are untyped JSON; tests read them with `any` rather than restating
    // every response shape.
    files: ['test/**/*.ts', 'src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/dot-notation': 'off',
    },
  },
  {
    // Tenant guard, layer 3 (PLAN §3.6): the raw driver bypasses the Mongoose plugin, so only
    // src/data/ may reach it, whether by import (dependency-cruiser) or through Mongoose.
    files: ['src/**/*.ts'],
    ignores: ['src/data/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message: 'Use a const object or a union of string literals (erasableSyntaxOnly).',
        },
        {
          selector: "MemberExpression[property.name='collection']",
          message: 'Model.collection bypasses the tenant guard. Use the model, or src/data/.',
        },
        {
          selector:
            "MemberExpression[object.name='mongoose'][property.name=/^(mongo|connection)$/]",
          message: 'Raw driver access bypasses the tenant guard. Use src/data/.',
        },
        {
          // Mongoose queries are thenables that run at most once. GraphQL-js may call `.then`
          // twice on a resolver's return value, so every chain ends in `.exec()` (a Promise).
          selector:
            'CallExpression[callee.property.name=/^(lean|orFail|sort|limit|select|populate)$/]:not(MemberExpression > CallExpression.object)',
          message: 'End Mongoose query chains with .exec() so they return a real Promise.',
        },
        {
          selector: "Property[key.value='$lookup']",
          message: 'Build $lookup stages with tenantLookup() from src/data/ (PLAN §3.6 layer 2).',
        },
      ],
    },
  },
];
