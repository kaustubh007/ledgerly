# Ledgerly

Multi-tenant invoicing SaaS, built phase by phase as a learning vehicle for Node.js, TypeScript,
GraphQL, React/Next.js, Redux Toolkit, Apollo, SCSS theming, a11y, i18n, security and AWS.
Plan: `PLAN.md`. Decisions: `DECISIONS.md`, `docs/adr/`.

## Commands

- `pnpm install` — install (Node 24 LTS, pnpm via corepack)
- `pnpm check` — everything CI runs: format, lint, typecheck, test with coverage, depcruise
- `pnpm test` — unit tests
- `make up` / `make down` — local infrastructure (MongoDB replica set, OTel collector, Jaeger)
- `make smoke` — proves the replica set, a transaction, and tracing end to end
- `make up-aws` — adds LocalStack (needs `LOCALSTACK_AUTH_TOKEN`)
- `make env` / `make api` / `make smoke-api` — dev keys, run the API, prove tracing end to end
- `pnpm --filter @ledgerly/api codegen` — regenerate resolver types after a schema change
- `pnpm --filter @ledgerly/web codegen` — regenerate typed documents after changing a query
- `make web` / `make e2e` — run the Next.js app; Playwright against a fresh e2e database

## Non-negotiable rules

- Money is `Money` from `@ledgerly/domain`: `bigint` minor units plus a `Currency`. A JS `number`
  holding money is a defect.
- Rounding happens only in `Money.multiplyAndRound` (half-even). `Money` has no division.
- Mixing currencies throws `CurrencyMismatchError`. No FX anywhere; totals are never summed
  across currencies.
- `packages/domain` has zero runtime dependencies and imports nothing outside itself.
  `apps/web` never imports `mongoose` or `apps/api`. Only `apps/api/src/data/` imports the raw
  MongoDB driver. dependency-cruiser enforces these in CI.
- Tenant `orgId` comes from the verified request context, never from arguments.
- Roles are loaded per request, never read from token claims.
- Tokens never touch `localStorage` or JS-readable cookies.
- GraphQL types are separate from domain types and Mongoose documents (codegen mappers).
- Every tenant schema declares `orgId: tenantOrgId` and uses `tenantGuard`. Every new Query or
  Mutation field must be covered by `apps/api/test/tenant-leak.test.ts` (the suite enforces it).
- Mongoose query chains end in `.exec()`; raw driver access only in `apps/api/src/data/`.
- Web: client components never fetch during SSR; first-render data comes from Server Components
  (`query`, or `<PreloadQuery>` + `useReadQuery`). Switching organisation is a full page load.
- Web: the Redux store is created per request (`StoreProvider`), never at module level.
- Web: `'use client'` modules export only components; shared values live in `constants.ts`
  (`test/client-boundary.test.ts` enforces it).
- External side effects (the payment gateway) never run inside a database transaction. They
  run after the replay check, with `gatewayKey`, and are compensated (refund) if recording fails.
- Plan limits are checked with `checkCapacity` inside the transaction that creates the resource.
- Never commit a red build. Never leave a TODO in a completed phase.

## Style

- Feature-first folders, not layer-first.
- Strict TypeScript; no `any`, no non-null assertions without a comment saying why.
- Domain tests use no mocks. API tests use a real MongoDB replica set (Testcontainers).
- Component tests query by role/label (RTL), and run axe.

## Pinned versions — do not "upgrade to latest" without checking

- Node **24 LTS** (`.nvmrc`). Node 26 is "Current" until promoted to LTS.
- TypeScript **~6.0** — `typescript-eslint@8` declares `typescript <6.1.0`; `latest` is 7.x.
- `graphql` **^16** — `@apollo/server@5` declares `graphql ^16.11.0`; `latest` is 17.x.
- Next.js 16 renamed `middleware.ts` to `proxy.ts`.
- LocalStack requires an auth token since 2026.03.0. We use a Hobby (non-commercial) token, only
  for S3/SQS/SES/Lambda. Everything else in infra is verified by CDK assertions and cdk-nag.

## Process

- Phases and gates are in `PLAN.md`. Complete one phase, report honestly on what works, what is
  partial, and what was skipped, then stop for review.
- Each phase ends with `docs/learn/phase-N.md`: what was built, why, trade-offs, what to study,
  and a retro.
- Anything decided that the plan did not specify goes in `DECISIONS.md`.
- Architecture decisions go in `docs/adr/` in MADR format. Accepted ADRs are superseded, never
  edited.
- Deliberate simulations are named `*Simulator` and are called out in the README.
