# Decisions

Decisions the plan did not specify, or that were made in review. Newest first within a phase.

## Phase 3 (2026-10-28)

- **Linting without `eslint-config-next`.** It depends on `eslint-plugin-jsx-a11y`,
  `eslint-plugin-react` and `eslint-plugin-import`, whose peer ranges stop at ESLint 9 (jsx-a11y
  has not released since 2024). With `strictPeerDependencies` that fails the install. The web app
  assembles the same rules from ESLint-10-compatible plugins: `@next/eslint-plugin-next`
  (core-web-vitals), `eslint-plugin-react-hooks` 7, and `eslint-plugin-jsx-a11y-x` (the maintained
  fork, `strict` preset). Downgrading the web app to ESLint 9 was the alternative.
- **pnpm minimum release age is respected, not bypassed.** pnpm auto-added
  `minimumReleaseAgeExclude` entries for `@hookform/resolvers@6.0.2` and `sass@1.107.0`
  (published the same day). Removed; pinned 6.0.0 and 1.106.1 instead.
- **Dependency build scripts:** `@parcel/watcher` (only for `sass --watch`) and `@swc/core`
  (optional codegen transpiler) are denied. `@apollo/client`'s bundled "agent skills" are not
  approved: no reason to let a dependency add instructions to an agent.
- **Playwright pinned to 1.63.0**, the version whose Chromium the dev container ships. CI installs
  the matching browser. Renovate bumps it like anything else.
- **Locale from `next/root-params`** (Next 16), as next-intl 4.14 recommends; `setRequestLocale`
  and `requestLocale` are deprecated. `next typegen` runs before `tsc` to generate its types.
- **Routes:** `/[locale]/(auth)/sign-in|sign-up`, `/[locale]/o` (picks the first organisation),
  `/[locale]/o/[orgSlug]/…` (the app). Unknown paths render a localised 404.
- **`proxy.ts` only negotiates the locale.** It cannot decide authentication: the refresh cookie
  is scoped to `/graphql/auth` (ADR-0005) and never reaches page requests, so "access token
  expired" and "signed out" look the same there. The org layout decides instead, and renders
  `RestoreSession` (a client component that refreshes once and re-renders) when the server sees
  no user. A per-path guard stops a refresh loop.
- **Server Components call the API directly** (`API_INTERNAL_URL`) forwarding only the
  `__Host-at` cookie; the browser calls `/graphql` on its own origin through a Next rewrite in
  dev (CloudFront in prod, ADR-0001). Rewrites are resolved at build time, so `API_INTERNAL_URL`
  is a build input (declared in `turbo.json`).
- **Client components never fetch during SSR.** The SSR Apollo client is a link that throws with
  an explanation; authenticated data for the first render comes from Server Components (`query`)
  or `<PreloadQuery>` with a `queryRef` render-prop read by `useReadQuery`. The plain-children
  form of `PreloadQuery` only fills the _browser_ cache and was caught by that guard.
- **Pages tolerate their layout's verdict.** Layouts and pages render in parallel; when the layout
  shows `RestoreSession` or a 404, page queries use `errorPolicy: 'all'` so their (discarded)
  failure is not logged as a crash.
- **Switching organisation is a full page load** (plain `<a>`, not client navigation). Apollo's
  cache is not keyed by organisation (the org travels in the `x-org` header), so a client-side
  switch could briefly show the previous org's cached data. Org switches are rare; a reload is
  cheap and cannot leak.
- **Session refresh coordination:** per tab, one in-flight promise; across tabs, a Web Lock
  serialises refreshes and a BroadcastChannel announces them (and sign-outs), so N tabs make one
  network call. The plan mentioned only BroadcastChannel; without the lock, two tabs could still
  both call the server. Found by a unit test: "already refreshed by another tab" must compare
  timestamps strictly, or a refresh starting in the same millisecond is skipped.
- **Sign-out signs out every tab** (BroadcastChannel), and still signs this browser out when the
  logout request fails (found by a unit test: the error escaped as an unhandled rejection).
- **Redux store per request, in two places:** the `(auth)` layout and the org layout each mount a
  `StoreProvider` (`useState` initialiser → one store per request on the server, per page load in
  the browser). The org layout preloads the session view and the theme; nothing else needs Redux
  yet. Slices: `ui`, `toasts`, `session`. Middleware: a listener that persists the theme to a
  readable `ledgerly-theme` cookie and applies it; a custom analytics middleware forwarding a
  small allowlist of action _types_ (no payloads) to a sink. There is no analytics backend in
  scope: the sink logs in development and discards otherwise.
- **Theme is server-rendered** from the cookie (`data-theme` on `<html>`), so there is no flash.
- **Translations:** en, de and ar message files from day one, with a test for identical keys and
  for ICU plurals in each locale (Arabic has six plural categories). The German and Arabic texts
  were written by Claude and need a native-speaker review before release.
- **axe in unit tests uses `axe-core` directly** instead of `vitest-axe` (unmaintained since
  2022): a ten-line helper with colour contrast disabled, because jsdom has no layout. Playwright
  runs full axe, contrast included, on real pages.
- **Import alias is `@web/*`, not `@/*`,** so each app's alias is unambiguous in the monorepo and
  dependency-cruiser can resolve it (`tsconfig.depcruise.json`).
- **E2E runs on its own database** (`ledgerly_e2e`, dropped before each run) and always starts its
  own API and web server. Found when the sign-up rate limit (20/h per IP) correctly started
  refusing accumulated local runs.
- **Web server tracing:** `instrumentation.ts` starts the OTel Node SDK with the undici
  instrumentation, so the server's fetches to the API carry `traceparent`: Jaeger shows traces
  spanning `ledgerly-web` and `ledgerly-api`.
- **Not done in Phase 3:** CSP nonces and security headers (Phase 8), the full SCSS token system
  and dark-mode polish (Phase 7), forms beyond sign-in/up and any mutation UI (Phase 4), a
  sessions/settings page, the React Compiler (Phase 6). Browser-side OTel spans are not set up.

## Phase 2 (2026-10-28)

- **Refresh cookie is `__Secure-rt` on `/graphql/auth`** (ADR-0005). ADR-0003's `__Host-rt` with
  a narrow path is a combination browsers reject.
- **Refresh and logout are REST** (`POST /graphql/auth/refresh|logout`), inside the `/graphql*`
  route of ADR-0001, and require an `x-ledgerly-csrf` header on top of SameSite.
- **Session revocation is immediate.** Each request checks that the access token's session is
  still live (one indexed lookup), so a revoked or reused session stops working before its
  10-minute access token expires.
- **Reuse detection keeps the last 20 retired refresh hashes** per session, so reuse of a token
  older than the immediate predecessor is detected too, not just treated as unknown.
- **Global (non-tenant) collections:** users, sessions, organizations, memberships,
  one-time tokens, rate limits, outbox. Memberships are global because "which orgs am I in?"
  crosses tenants; every org-scoped membership query filters by the context org explicitly and
  lives only in `features/organizations`.
- **Tenant collections declare `orgId: tenantOrgId` explicitly**, and the guard refuses to
  attach to a schema without it. The plan had the plugin add the field, which left it out of the
  inferred TypeScript types.
- **Tenant guard extras beyond the plan:** refuses `estimatedDocumentCount`, `bulkWrite`,
  `$unionWith`, `$graphLookup`, `$out`, `$merge`, `$documents`; checks `$lookup` inside `$facet`;
  refuses a filter naming another org rather than silently overriding it.
- **ESLint guards the tenant guard:** outside `src/data/`, `Model.collection`, `mongoose.mongo`,
  `mongoose.connection` and `$lookup` literals are lint errors.
- **Every Mongoose query chain ends in `.exec()`** (lint rule). Found the hard way: GraphQL-js
  may call `.then` twice on a resolver's return value, and a Mongoose `Query` runs only once.
- **`transactionAsyncLocalStorage`** is on: inside `connection.transaction()`, every model call
  joins the transaction without passing `{ session }`.
- **`useBigInt64`** on the connection: int64 comes back as `bigint` everywhere (fixes the BSON
  `Long` gotcha recorded in Phase 1). `strictQuery: 'throw'` makes an unknown filter key an error.
- **Idempotency stores the outcome (`{ ok, id }` or `{ ok: false, userErrors }`), not the
  response body.** Replays re-read the entity, so the replayed response is current. Keys are
  unique per organisation, hashed with operation + user + input.
- **Invoice numbers are `INV-{year}-{seq:00000}` with one sequence per organisation**, not per
  year; the year in the number is the send year.
- **Email goes through a transactional outbox** (`outbox` collection), written in the same
  transaction as its cause. Nothing sends yet; Phase 8 adds the SQS → Lambda → SES dispatcher.
  Until then, dev links can be read from the collection.
- **Rate limits are fixed windows in MongoDB** (shared across API tasks): log-in 10/15 min per
  email and 100/15 min per IP; sign-up 20/h per IP; password reset 5/h per email.
- **Sign-up reveals that an email is taken** (`EMAIL_TAKEN`). Accepted trade-off for a clear
  form error; log-in and password reset do not reveal it.
- **Password policy:** 12–128 characters, no composition rules (NIST SP 800-63B). argon2id with
  OWASP parameters (19 MiB, t=2, p=1); a dummy hash is verified when the email is unknown.
- **Query limits:** depth 12 and 20 aliases, as hand-written GraphQL validation rules.
  `@escape.tech/graphql-armor` was considered; its peer dependencies (`@envelop/core`) fail
  `strictPeerDependencies`, and two short rules are clearer to learn from.
- **API tests go over real HTTP** with a cookie jar that honours `Path` and `Max-Age`, against a
  Testcontainers MongoDB 9.0.4 replica set, one database per test file. The plan said
  `executeOperation`, which would skip cookies, headers and CSRF prevention.
- **The tenant-leak suite enumerates the schema:** every Query and Mutation field must be
  exercised by the suite or be listed as not tenant-scoped, so a new resolver fails CI until it
  is covered.
- **Contract test (PLAN §3.4) checks field names and required-ness** of every GraphQL input type
  against its zod twin.
- **Vitest resolves workspace packages to source** with `ssr.resolve.conditions` as well as
  `resolve.conditions`. Phase 1 set only the latter, which Vitest's Node runs ignore; nothing
  caught it because no Phase 1 test crossed a package boundary.
- **pnpm 12 blocks dependency build scripts**; the four packages that have them are listed as
  not allowed in `pnpm-workspace.yaml` (none is needed).
- **Mongoose 9 deprecates `new: true`**; we use `returnDocument: 'after'`.
- **Collector exporter renamed** `otlp` → `otlp_grpc` (deprecated alias in collector 0.164).
- **Jaeger 2.x query API is `/api/v3`**; `scripts/smoke-api.sh` uses it.
- **Request logs:** one `request` line per request with method, path, status, duration,
  `requestId`, `userId`, `orgId` and `traceId`. Cookies, tokens, passwords and emails are
  redacted.
- **CI** checks that generated resolver types are up to date, runs the API tests (Docker is on the
  runner), and starts the built API against the compose stack to run `smoke-api.sh`.
- **Not done in Phase 2:** the outbox dispatcher (Phase 8), org time-zone editing (no mutation
  yet; defaults to UTC), customer deletion, invoice PDFs, `updateCustomer` currency-change rules.

## Plan revision 3 (2026-10-28, during Phase 1 review)

- **Option A chosen by the owner:** keep Next.js for the tenant product and add a platform admin
  console built with Vite + React Router 8 (data mode) + Redux Toolkit/RTK Query, so plain React
  routing and Redux-owned server state are both learned. Inserted as Phase 5; later phases
  renumbered 6–8. PLAN §3.14 and ADR-0004, **accepted** by the owner on 2026-10-28 together with
  the Phase 1 review.
- **React Router data mode, not framework mode.** Framework mode is a server-rendering framework
  in its own right (the Remix successor); using it would duplicate what Next.js already teaches.
  Data mode keeps the console a static SPA.
- **The TOTP module moves from Phase 7 to Phase 5,** because staff must use MFA from their first
  login. Tenant-user MFA still ships in Phase 8 (E8) on the same module.
- **Cognito stretch ADR renumbered to ADR-0005.**
- **Admin console is English-only,** with strings behind one `t()` helper. WCAG 2.2 AA applies.
- dependency-cruiser rule `web-never-touches-the-database` now covers `apps/admin` too. The
  `runAsPlatform` import restriction is added in Phase 5, when the module exists.

## Phase 1 (2026-10-28)

- **MongoDB 9.0.4, not 8.** `mongo:latest` is 9.0.4. Verified before choosing: a single-node
  replica set on 9.0.4 runs multi-document transactions through Mongoose 9.11.4 (driver 7.7)
  and round-trips an int64 above 2^53. Whether Atlas offers 9.0 on the tier we pick is checked
  in Phase 8 (AWS); if not, prod runs 8.x and this entry is revisited.
- **Phase 2 gotcha found while verifying:** `Model.find().lean()` returns a BSON `Long`, not a
  `bigint`, for a `BigInt` path. The codegen mappers in Phase 2 convert at the data boundary.
- **pnpm 12.16.1** via `packageManager` + corepack (current `latest`).
- **Peer pins are enforced, not just documented.** `strictPeerDependencies: true` in
  `pnpm-workspace.yaml`. Verified: setting `typescript` to 7.0.2 makes `pnpm install` fail with
  `ERR_PNPM_PEER_DEP_ISSUES`. The plan said Renovate would open the bump "the day the peer range
  widens"; Renovate does not read peer ranges, so the PR opens immediately and stays red until
  then. PLAN §1 corrected.
- **Workspace packages resolve to source in dev and tests** via the custom export condition
  `@ledgerly/source` (set in `tsconfig.base.json` `customConditions` and Vitest
  `resolve.conditions`), and to `dist/` everywhere else. Tests never run against a stale build.
- **Relative imports use `.ts` extensions** with `rewriteRelativeImportExtensions`, and
  `erasableSyntaxOnly` is on (so no `enum`s; ESLint bans them with a message). Node 24 can run
  the sources directly, and `tsc` emits `.js` specifiers.
- **Domain errors are split in two.** Programmer errors and corrupt input throw a `DomainError`
  subclass (`CurrencyMismatchError`, `MoneyOverflowError`, `UnknownCurrencyError`, ...).
  Business-rule refusals a user can trigger are returned as `Result` values with a `code`, which
  map one-to-one onto GraphQL `userErrors` in Phase 2.
- **Money range is int64**, the storage type; BigInt itself never overflows, so the domain
  enforces the range and throws `MoneyOverflowError`.
- **Money has `equals` and `compare` with different semantics on purpose:** `equals` across
  currencies is `false`; `compare` across currencies throws (ordering USD against EUR is a bug).
- **Currencies are an allowlist of 14** (2-, 0- and 3-decimal cases all present), not all of
  ISO 4217. Adding one is a one-line change plus a test.
- **Quantity**: positive, at most 3 decimal places, at most 1,000,000,000 units.
- **Line rounding**: each line is rounded once (half-even) and the invoice total is the sum of
  rounded lines, so the printed lines always add up to the printed total.
- **Zero-priced lines are allowed; sending needs a positive total** (`EMPTY_INVOICE`).
- **The domain invoice has no number, customer or dates.** Numbering is allocated in the send
  transaction (ADR-0002) by the application layer; overdue logic needs the org's time zone and
  arrives with E4.
- **dependency-cruiser rules for `apps/api` and `apps/web` exist before the apps do.** Each rule
  was proved to fire with a throwaway violating file, including the raw-driver rule against a
  real `mongodb` install.
- **Accepted ADRs are excluded from Prettier**, because reformatting is editing.
- **LocalStack is defined but not exercised.** It sits behind the compose profile `aws` and
  needs a Hobby token; no token was available in this environment. Nothing in Phase 1 calls AWS.
- **CI uses `make up` + `make smoke`** to prove the replica set, a real transaction, the
  collector, and a span reaching Jaeger. GitHub Actions versions are the current majors
  (checkout v7, setup-node v7, pnpm/action-setup v6, upload-artifact v7, codeql v4); Renovate
  pins them to digests.

## Phase 0 (2026-10-28)

- All §11 recommendations accepted by the owner:
  - Auth: ADR-0003, hand-rolled; Cognito as stretch S1.
  - Hosting: ECS Fargate for both `web` and `api`.
  - Database: MongoDB Atlas (replica set; PrivateLink from M10 in prod).
  - LocalStack: Hobby token; the project is non-commercial. If that changes, CI switches to the
    in-memory fakes and this entry is superseded.
  - Name: Ledgerly.
- ADR-0001, ADR-0002 and ADR-0003 moved from `proposed` to `accepted`.
- Repository is separate from `kaustubh007/DigiPayments` (Meridian Pay); nothing is shared
  between them.
