/**
 * Architecture rules from CLAUDE.md, enforced in CI. Rules for apps/web and apps/api are
 * already in place so they bite the moment those apps are created.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment:
        'packages/domain has zero dependencies: no npm packages, no Node built-ins, no other ' +
        'workspace packages. Tests may use their test tooling.',
      severity: 'error',
      from: { path: '^packages/domain/src/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: '^packages/domain/src/' },
    },
    {
      name: 'web-never-touches-the-database',
      comment:
        'apps/web and apps/admin talk to the API over GraphQL. They never import the API or a ' +
        'DB driver.',
      severity: 'error',
      from: { path: '^apps/(web|admin)/' },
      to: { path: ['^apps/api/', 'node_modules/(mongoose|mongodb)/'] },
    },
    {
      name: 'raw-driver-only-in-data-layer',
      comment:
        'The raw MongoDB driver bypasses the tenant guard. Only apps/api/src/data/ may use it ' +
        '(PLAN §3.6, layer 3).',
      severity: 'error',
      from: { path: '^apps/api/src/', pathNot: '^apps/api/src/data/' },
      to: { path: 'node_modules/mongodb/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['/dist/', '/coverage/', '\\.config\\.(js|ts|cjs)$'] },
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['@ledgerly/source', 'import', 'node', 'types', 'default'],
      mainFields: ['module', 'main', 'types', 'typings'],
      extensions: ['.ts', '.tsx', '.d.ts', '.js', '.mjs', '.cjs', '.json'],
    },
  },
};
