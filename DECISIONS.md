# Decisions

Decisions the plan did not specify, or that were made in review. Newest first within a phase.

## Plan revision 3 (2026-10-28, during Phase 1 review)

- **Option A chosen by the owner:** keep Next.js for the tenant product and add a platform admin
  console built with Vite + React Router 8 (data mode) + Redux Toolkit/RTK Query, so plain React
  routing and Redux-owned server state are both learned. Inserted as Phase 5; later phases
  renumbered 6–8. PLAN §3.14 and ADR-0004 (status **proposed**, awaiting owner review).
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
