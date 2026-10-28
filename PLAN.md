# Ledgerly — Plan (Phase 0 deliverable, revision 2)

Status: **Phase 0 approved 2026-10-28.** All recommendations in §11 accepted; see `DECISIONS.md`.

Revision 2 incorporates the independent architecture review (19 findings). §10 maps every
finding to where it is addressed.

Ledgerly is a multi-tenant invoicing SaaS built as a _learning vehicle_: every phase exists to
teach a specific set of skills, and every phase ends with a `docs/learn/phase-N.md` note that
explains what was built, why, the trade-offs, and a short retro. It is still built to production
standards — the point is to learn the version of each skill that survives a real code review.

"Ledgerly" is a placeholder name.

---

## 1. Version pins (checked against npm on 2026-10-28)

Everything is on current stable **except** where a peer dependency forbids it:

| Package      | `latest`          | We pin     | Why                                                                                                                 |
| ------------ | ----------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `typescript` | 7.0.2             | **~6.0**   | `typescript-eslint@8.72` declares `typescript >=4.8.4 <6.1.0`. TS 7 (native Go compiler) breaks the lint toolchain. |
| `graphql`    | 17.0.2            | **^16.14** | `@apollo/server@5.5` declares `graphql ^16.11.0`. Web and API share one `graphql` in the monorepo.                  |
| Node         | 26.12.1 (Current) | **24 LTS** | Production runs LTS. Move to 26 when it is promoted to LTS.                                                         |

Each pin carries a comment in `package.json`. Renovate opens the major bump PR straight away;
`strictPeerDependencies` keeps it red until the blocking package widens its range, and it is
merged when it goes green (corrected in Phase 1, see `DECISIONS.md`).

| Area              | Package                                                                                                                                                                    | Version                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Web               | `next` / `react`                                                                                                                                                           | 16.4.x / 19.3.x (App Router, RSC; note Next 16 renamed `middleware.ts` → **`proxy.ts`**) |
| GraphQL client    | `@apollo/client` + `@apollo/client-integration-nextjs`                                                                                                                     | 4.3.x / 0.14.x                                                                           |
| GraphQL server    | `@apollo/server`                                                                                                                                                           | 5.5.x                                                                                    |
| State             | `@reduxjs/toolkit` / `react-redux`                                                                                                                                         | 2.13.x                                                                                   |
| DB                | `mongoose`                                                                                                                                                                 | 9.11.x on MongoDB 9.0 (**replica set**, see §3.5)                                        |
| Auth              | `jose`, `@node-rs/argon2`, `otplib`                                                                                                                                        | current                                                                                  |
| i18n              | `next-intl`                                                                                                                                                                | 4.14.x                                                                                   |
| Styling           | `sass`                                                                                                                                                                     | 1.106.x                                                                                  |
| Codegen           | `@graphql-codegen/cli`                                                                                                                                                     | 7.4.x                                                                                    |
| Logging / tracing | `pino`, `@opentelemetry/sdk-node`                                                                                                                                          | current stable                                                                           |
| Tests             | `vitest` 5, `@testing-library/react` 16, `user-event`, `vitest-axe`, `fast-check`, `@testcontainers/mongodb`, `@playwright/test` (container build), `@axe-core/playwright` |                                                                                          |
| IaC               | `aws-cdk-lib` 2.x, `cdk-nag`                                                                                                                                               |                                                                                          |

---

## 2. Product

Tenants (organisations) sign up, invite members, manage customers, issue invoices, record
payments, and see a dashboard. Ledgerly itself is a SaaS with plans.

- **User** — global identity. A user may belong to **many** organisations.
- **Organisation** — the tenant boundary. Every tenant document carries `orgId`.
- **Membership** — user × org × role (`OWNER`, `ADMIN`, `ACCOUNTANT`, `VIEWER`).
- **Plan / Subscription** — `FREE`, `PRO`, `BUSINESS`; limits (customers, invoices/month,
  members) and feature flags (custom branding, MFA enforcement, audit export). Paid through
  `BillingGatewaySimulator` (named and called out as a simulation).
- **Customer** — name, email, billing address, default currency, **document locale** (the
  language invoices/emails are sent in; independent of the UI locale).
- **Invoice** — per-org sequential number, customer, line items, currency, status
  (`DRAFT → SENT → PARTIALLY_PAID → PAID`, plus `VOID` from `DRAFT`/`SENT`), due date.
- **Payment** — amount against an invoice, recorded manually or via
  `PaymentGatewaySimulator`.

### 2.1 Money

- `Money = { amountMinor: bigint, currency: Currency }` in `packages/domain`. Never a JS `number`.
- Stored in MongoDB as **int64 (`Long`)**, plus `currency` string. GraphQL exposes a `Money`
  object with `amountMinor: BigInt` (custom scalar serialised as a string) and `currency`.
- Line item: `quantity` is a decimal with at most 3 fractional digits, stored as integer
  thousandths; `unitPrice` is `Money`. Line total = `unitPrice × quantity` rounded **once**,
  half-even, in `Money.multiplyAndRound` — the only rounding function in the codebase.
- No tax engine, no discounts (stretch), no FX. Totals are never summed across currencies.

---

## 3. Architecture

```
                         one site:  app.ledgerly.example
 Browser ──HTTPS──▶ CloudFront (WAF)
                      ├── /graphql*  ─────────────▶ ALB ─▶ api  (ECS Fargate, Apollo Server)
                      ├── /_next/static/*  ───────▶ S3 (immutable assets)
                      └── /*  ──────────────────────▶ ALB ─▶ web  (ECS Fargate, Next.js)
                                                         │
          web (RSC/Route Handlers) ── server-side fetch ─┘ to api over the private ALB,
                                       forwarding the session cookie
   api ─▶ MongoDB Atlas (PrivateLink)   api ─▶ S3 (logos, PDFs)
   api ─▶ SQS ─▶ Lambda worker ─▶ SES (emails) / S3 (PDFs)
   Secrets Manager · CloudWatch · X-Ray (via OTel collector)
```

### 3.1 Request routing — the browser and the API are same-origin (ADR-0001)

CloudFront serves the web app and the API under **one origin**; `/graphql` is path-routed to the
API service. Consequences:

- Session cookies are first-party, `httpOnly; Secure; SameSite=Lax; Path=/`. No CORS anywhere.
- Browser-side Apollo Client calls `/graphql` (relative URL).
- Server Components and Route Handlers call the API **over the internal ALB** and forward the
  incoming `Cookie` header plus `traceparent`; they never mint their own credentials.
- Locally, Next's `rewrites` reproduces the same `/graphql` routing so dev matches prod.

### 3.2 Repo layout — pnpm workspaces + Turborepo

```
apps/
  web/        Next.js 16 App Router
  api/        Apollo Server 5 + Mongoose (feature-first: modules/invoices, modules/customers…)
  worker/     Lambda handlers (email, PDF)
packages/
  domain/     Pure TS: Money, invoice state machine, permissions, plan limits. Zero deps.
  graphql/    schema/*.graphql + codegen output shared by web and api
  validation/ zod schemas for inputs (see §3.4 on drift)
  ui/         Design-system components + SCSS tokens
  config/     eslint, tsconfig, vitest presets
infra/        AWS CDK app
docs/adr/     MADR records    docs/learn/  per-phase learning notes
```

`dependency-cruiser` in CI: `packages/domain` imports nothing; `apps/web` never imports
`mongoose` or `apps/api`; only `apps/api/src/data/` imports the raw MongoDB driver.

### 3.3 GraphQL design

- **Schema-first**. Codegen produces resolver types (with **mappers** from GraphQL types to
  Mongoose documents, so resolvers receive DB shapes, not GraphQL shapes) and typed documents
  for the client.
- Relay-style cursor pagination; mutations return payloads with `userErrors` (domain errors are
  data, not GraphQL errors).
- **DataLoader** per request (invoice → customer, membership lookup).
- Depth and complexity limits; persisted queries (APQ) in production; introspection off in prod.
- Apollo Server's built-in **`csrfPrevention`** stays on (requires a non-simple content type or
  `apollo-require-preflight` header). Together with `SameSite=Lax` this is the CSRF defence.
  No double-submit token — the learning note explains why it is redundant here.

### 3.4 Validation — two schemas, named on purpose

GraphQL SDL defines _shape_; zod defines _business validation_ (lengths, formats, ranges) and is
shared by forms and resolvers. These can drift. Mitigation: a contract test generates a valid and
an invalid example per input type from the zod schema and runs both through the real GraphQL
schema. Accepted trade-off for a learning project; a stretch item evaluates deriving one from
the other.

### 3.5 Data integrity (ADR-0002)

- MongoDB runs as a **replica set everywhere** — Atlas in prod, single-node `rs0` in Docker
  Compose and in Testcontainers — because multi-document transactions require it.
- **Record payment** runs in one transaction: load invoice → check status and remaining balance →
  insert payment → update invoice status/paid amount. Write conflicts abort and retry
  (driver `withTransaction`). Two concurrent payments cannot jointly overpay.
- **Idempotency**: every state-changing mutation accepts an `idempotencyKey` (UUID generated
  when the form opens). Stored in `idempotency_keys` with a unique index on
  `(orgId, key)` and the stored response, TTL 24 h. A replay returns the original result; a
  replay with a _different_ payload returns `IDEMPOTENCY_KEY_REUSED`.
- **Invoice numbers**: allocated when an invoice is **sent**, not drafted — drafts get no number,
  so deleted drafts never leave gaps. `counters` collection, `{orgId, name:'invoice', seq}`,
  incremented with `findOneAndUpdate({$inc:{seq:1}})` inside the send transaction. Unique index
  on `(orgId, number)` as the backstop. Format per org: `INV-{yyyy}-{seq:00000}`.
- **Plan limits** are checked inside the same transaction as the write they limit.

### 3.6 Tenancy and authorisation

- **Active organisation** is part of the URL: `/[locale]/o/[orgSlug]/…`. Switching org is
  navigation. The API receives the org as the `x-org` header, set by Apollo Client from the
  route; the API **verifies membership** for that org on every request. A user can have several
  orgs open in several tabs safely.
- **Request context** lives in `AsyncLocalStorage`: `{ userId, orgId, membership, requestId }`.
- **Tenant guard, three layers:**
  1. A Mongoose plugin reads `orgId` from AsyncLocalStorage and injects it into `find*`,
     `update*`, `delete*`, `countDocuments` **and `aggregate`** (prepends a `$match`), and
     throws if no org is in context for a tenant model.
  2. `$lookup` stages are only built through a helper that adds the `orgId` match to the
     sub-pipeline; a lint rule bans `$lookup` literals outside it.
  3. The raw driver is only reachable from `apps/api/src/data/` (dependency-cruiser), and that
     layer is reviewed as security-critical code.
     The tenant-leak suite seeds two orgs and asserts every query, mutation, **and dashboard
     aggregation** returns only the caller's data.
- **Authorisation** uses the membership loaded per request (DataLoader-cached), **not** claims
  in the token. A role change or removal takes effect on the next request.

### 3.7 Authentication (ADR-0003, hand-rolled; Cognito as stretch ADR)

- argon2id password hashes (`@node-rs/argon2`, OWASP parameters).
- **Access token**: JWT via `jose`, 10 min, carries **identity only** (`sub`, `sid`), cookie
  `__Host-at`.
- **Refresh token**: opaque random 256-bit, stored **hashed** in Mongo, rotated on every use,
  cookie `__Host-rt` scoped to the refresh route.
- **Reuse detection with a grace window**: a rotated token presented again within **20 s**
  returns the _same_ successor (concurrent tabs refreshing at once); after the grace window a
  reuse revokes the whole session family. Refresh is also serialised in the browser with a
  single in-flight promise and a `BroadcastChannel` so tabs share one refresh.
- Sessions are listable and revocable ("sign out other devices").
- Email verification, password reset (SES via SQS worker), login rate limiting per IP and per
  account, generic error messages.
- **TOTP MFA** with recovery codes — Phase 7 (one place only; see §5).
- Tokens never touch `localStorage` or JS-readable cookies.

### 3.8 Where client state lives

| Kind of state                                                                            | Owner                                                                                                             |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Server data                                                                              | Apollo Client normalized cache                                                                                    |
| URL state (org, filters, page, sort)                                                     | The URL                                                                                                           |
| Form state                                                                               | `react-hook-form` + shared zod schema                                                                             |
| Cross-cutting UI state (theme, sidebar, toasts, multi-step invoice wizard, session view) | Redux Toolkit (store created **per request** inside a client provider — never a module-level singleton under SSR) |
| Component-local                                                                          | `useState` / `useReducer`                                                                                         |

Redux middleware is taught where it has a real job: a listener middleware persisting theme and
locale to a cookie, and a custom middleware feeding the audit/analytics stream. The learning note
shows the anti-pattern (server data copied into Redux) side by side and why it goes stale.

### 3.9 Security baseline (OWASP ASVS L2 as the checklist)

- **CSP with per-request nonces** set in `proxy.ts`. Consequence, accepted and documented:
  nonces force **dynamic rendering** for every HTML route (no static/ISR pages in the app shell);
  the marketing pages live outside the nonce'd layout and stay static.
- **Tenant brand colour** is emitted server-side in a `<style nonce>` block defining CSS custom
  properties — never via a `style=""` attribute — so `style-src` needs no `'unsafe-inline'`.
- HSTS, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, WAF managed rules,
  GraphQL depth/complexity limits, zod validation at the edge, RBAC via
  `packages/domain` permission functions, secrets only in Secrets Manager, Dependabot/Renovate,
  CodeQL, `pnpm audit` in CI, OWASP ZAP baseline scan in Phase 7.
- **Privacy**: account deletion and data export (§6 E7).

### 3.10 Observability — from Phase 2, not Phase 8

- `pino` structured JSON logs with `requestId`, `orgId`, `userId` from AsyncLocalStorage;
  redaction of tokens, passwords, emails.
- OpenTelemetry Node SDK in the API from Phase 2 (HTTP, GraphQL, MongoDB spans) to a local
  collector + Jaeger in Docker Compose. Next.js server spans via Next's built-in OTel hook; the
  web server forwards `traceparent` to the API so one trace covers browser → web → api → Mongo.
- Errors: unhandled resolver errors are logged with the trace id and masked in responses.
- Prod: collector → X-Ray and CloudWatch.

### 3.11 Accessibility and i18n

- Target **WCAG 2.2 AA**. `eslint-plugin-jsx-a11y`; `vitest-axe` in component tests;
  `@axe-core/playwright` on every route in a real browser. **jsdom cannot evaluate colour
  contrast** (no layout, no computed colour), so contrast is only claimed from the Playwright
  run, never from unit tests. Manual keyboard + screen-reader (NVDA, VoiceOver) checklist per
  phase.
- `next-intl` with locale-prefixed routes (`en`, `de`, `ar`). Arabic forces **RTL**; logical
  CSS properties throughout. ICU plurals; money and dates through `Intl`. Invoice emails and
  PDFs use the **customer's** document locale, not the sender's UI locale.

### 3.12 Theming

SCSS token maps compiled to CSS custom properties; light / dark / high-contrast via
`[data-theme]`; per-tenant brand colour (plan feature) validated for AA contrast against each
theme before it is accepted.

### 3.13 Real-time updates (stretch)

`graphql-ws` subscriptions for "invoice paid". With more than one API task behind the ALB, events
must fan out through a shared bus: **ElastiCache Redis pub/sub** (`graphql-redis-subscriptions`).
The ALB needs WebSocket support and an idle timeout above the ping interval. If this stretch is
skipped, the UI polls the dashboard query every 30 s instead.

---

## 4. Testing strategy

| Tier                  | Tool                                            | Rules                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain                | Vitest + fast-check                             | No mocks. Property tests for Money and the state machine. 100 % branch coverage.                                                                                                              |
| API                   | Vitest + Testcontainers Mongo (**replica set**) | Real database; operations through `server.executeOperation`. Concurrency tests fire parallel `recordPayment` calls and assert no overpayment.                                                 |
| Client components     | Vitest + RTL + user-event + vitest-axe          | Query by role/label; no implementation details; `MockedProvider` + a real Redux store per test.                                                                                               |
| **Server Components** | —                                               | **RTL cannot render async RSCs.** Rule: RSCs only fetch and compose; logic lives in plain functions (unit-tested) and client components (RTL-tested). RSC behaviour is covered by Playwright. |
| E2E                   | Playwright + axe                                | Critical paths per phase; axe (incl. contrast) on every route in all three locales.                                                                                                           |
| Contract              | Vitest                                          | zod ↔ GraphQL input drift test (§3.4).                                                                                                                                                        |
| Infra                 | CDK assertions + `cdk-nag`                      | See §8.                                                                                                                                                                                       |

---

## 5. Phases

Phases 7 and 8 from revision 1 are merged. Stretch items are fully designed but optional; skipping
one never blocks the next phase.

| #   | Phase                          | You learn                                                                                                                                                                                            | Gate                                                                                                          |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 0   | **This plan** + ADR-0001..0003 | Architecture, trade-offs, agile backlog                                                                                                                                                              | You approve §11                                                                                               |
| 1   | Monorepo foundation            | TS project references, strict config, pnpm/Turbo, ESLint, Vitest, GitHub Actions, Docker Compose (Mongo **rs0**, OTel collector + Jaeger, LocalStack)                                                | CI green; domain Money + state machine at 100 % branch coverage; dependency-cruiser rules enforced            |
| 2   | API, data, auth, observability | Apollo Server, schema-first + codegen mappers, Mongoose, transactions, idempotency, DataLoader, AsyncLocalStorage tenancy, JWT + refresh rotation w/ grace window, RBAC, pino + OTel                 | Tenant-leak suite (incl. aggregations) passes; concurrent-payment test passes; traces visible in Jaeger       |
| 3   | Web shell                      | App Router, RSC vs client components, layouts, `proxy.ts`, org-scoped routing + org switcher, Redux store per request + middleware, Apollo SSR integration, cookie forwarding, single-flight refresh | Logged-in shell in 2 orgs in 2 tabs; RTL tests for slices, providers, guards                                  |
| 4   | Core features                  | TSX patterns, custom hooks, `useReducer`, `useOptimistic`, forms, optimistic mutations + cache updates, idempotency keys from forms, plans & limits (`BillingGatewaySimulator`)                      | Playwright: create → send (numbered) → pay an invoice; double-submit records one payment; plan limit enforced |
| 5   | Component craft & performance  | Class lifecycle (error boundary), HOC vs hooks vs render props, **manual memoisation with the React Compiler off → measure → compiler on → measure**, virtualisation, code-splitting                 | Profiler numbers for all three states committed in the learning note; Lighthouse ≥ 90                         |
| 6   | Theming, a11y, i18n            | SCSS architecture, tokens, dark/high-contrast, nonce'd brand styles, AA audit, RTL, ICU, customer-locale documents                                                                                   | axe zero violations on all routes × 3 locales in Playwright; manual audit checklist signed off                |
| 7   | Security, privacy & AWS        | Threat model, CSP/headers, TOTP MFA, rate limits, audit log, account deletion/export; CDK (VPC, ECS, CloudFront, S3, SES, SQS/Lambda, Secrets Manager, X-Ray)                                        | ZAP baseline clean; `cdk-nag` clean; threat model + cost estimate in `docs/`                                  |
| S1  | _Stretch_ Cognito              | Replacing hand-rolled auth behind the same `AuthProvider` port                                                                                                                                       | ADR-0004 + working spike branch                                                                               |
| S2  | _Stretch_ Subscriptions        | graphql-ws, Redis fan-out                                                                                                                                                                            | Two API tasks, event delivered to both clients                                                                |

**Effort estimate** (evenings/weekends, ~8 h/week): Phase 1 ≈ 1 week, 2 ≈ 3, 3 ≈ 2, 4 ≈ 3,
5 ≈ 2, 6 ≈ 2, 7 ≈ 3 → **about 16 weeks**, plus 1–2 weeks per stretch.
**Minimum useful cut: end of Phase 4** — a working, tested, multi-tenant app covering Node, TS,
GraphQL, React, Redux, Next, Apollo, routing, hooks and RTL. Phases 5–7 deepen it.

### Agile practice

The backlog becomes GitHub Issues: epics as labels/parent issues, stories with acceptance
criteria and Fibonacci points, one milestone per phase (sprint), PRs linked to stories.

**Definition of Done** for every story: acceptance criteria met; tests at the right tier; axe
clean for any UI; i18n strings extracted for all 3 locales; no new lint/type errors; docs/ADR
updated if a decision was made; CI green. Each phase ends with a retro (what went well / what
didn't / one change) in its learning note.

---

## 6. Backlog (epics → stories)

- **E1 Foundation** — monorepo; CI; Docker Compose; Money; invoice state machine.
- **E2 Identity** — sign up creates org + owner; log in/out; refresh rotation with grace window;
  sessions list + revoke; invite member; accept invite into an existing account (multi-org);
  role change; remove member; email verify; password reset; rate limiting. TOTP MFA lives in
  **E8** only.
- **E3 Customers** — CRUD; cursor-paginated searchable list; document locale and currency.
- **E4 Invoices** — draft with line items; send (allocates number, locks, emails); record
  payment (transactional, idempotent); void; overdue computation; URL-driven filters.
- **E5 Dashboard** — outstanding/overdue per currency; recent activity.
- **E6 SaaS plans** — plan catalogue; upgrade/downgrade via `BillingGatewaySimulator`; limit
  enforcement; feature flags; downgrade behaviour when over limit (read-only, never deletes).
- **E7 Privacy** — export my data (JSON zip to S3, signed URL); delete my account (blocked while
  sole OWNER of an org with other members; org deletion with 30-day grace period).
- **E8 Security** — TOTP MFA + recovery codes; org-enforced MFA (plan feature); audit log +
  export; security headers; threat model.
- **E9 Platform** — theming; i18n; observability; AWS deploy.

Example story:

> **E4-3 Record a payment.** As an ACCOUNTANT I can record a payment against a SENT or
> PARTIALLY_PAID invoice.
>
> - Amount must be in the invoice currency; otherwise a field error.
> - Overpayment rejected, **including when two payments are submitted concurrently**.
> - Submitting the same form twice (same idempotency key) records one payment.
> - Partial → PARTIALLY_PAID; full → PAID.
> - VIEWER does not see the action; calling the mutation as VIEWER returns `FORBIDDEN`.
> - The list updates via cache update (no refetch) and the change is announced via a live region.

---

## 7. ADRs written in Phase 0

- **ADR-0001** Same-origin routing of web and API behind CloudFront.
- **ADR-0002** Payment and invoice-numbering integrity: replica set, transactions, idempotency.
- **ADR-0003** Hand-rolled session auth with rotating refresh tokens (Cognito deferred to S1).

---

## 8. AWS, CI and cost

### 8.1 LocalStack is no longer free-by-default

Since LocalStack **2026.03.0** the community and pro images are one image that **requires an
auth token**, including in CI. A free **Hobby** plan covers non-commercial use with roughly the
old community feature set; commercial use needs a paid plan. Services such as Cognito are Pro
entitlements. Plan:

- Local dev and CI use LocalStack (Hobby token as a CI secret) **only for S3, SQS, SES and
  Lambda** — the services the app talks to at runtime.
- ECS, CloudFront, ALB, VPC are **not** emulated. Infra is gated by CDK assertion tests
  (`Template.fromStack`), `cdk synth`, and `cdk-nag` (AwsSolutions pack) in CI.
- An adapter interface around each AWS client keeps a no-LocalStack fallback (in-memory fakes)
  for contributors without a token. Fakes are named `*Fake` in tests only.

### 8.2 Network and cost

- Atlas reached over **AWS PrivateLink** (Atlas M10+; M0/Flex tiers do not support it — dev
  uses an IP allowlist on a NAT EIP instead, documented).
- **NAT gateways** are the surprise cost: one per AZ is ~US$32/month each plus data. Dev stack
  uses **one** NAT and VPC endpoints for S3/SQS/Secrets Manager/ECR to cut NAT traffic.
- Phase 7 deliverable: a cost table (dev vs prod) covering Fargate, ALB, NAT, CloudFront, Atlas
  tier, SES, CloudWatch, and a `cdk destroy` teardown checklist.

---

## 9. Known accepted trade-offs

- Two validation schemas (GraphQL + zod) with a drift test rather than a single source.
- Nonce CSP disables static rendering for the app shell.
- Redux's role is intentionally small; the learning value is in seeing why.
- Hand-rolled auth is more code to get right; mitigated by ADR-0003, the threat model, and S1.

---

## 10. Review findings → where addressed

| #   | Finding                                                     | Addressed in                                                      |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Browser → API path undefined                                | §3.1, ADR-0001                                                    |
| 2   | Payment race / double-submit                                | §3.5, §4, E4-3, ADR-0002                                          |
| 3   | Invoice numbering undefined                                 | §3.5, ADR-0002                                                    |
| 4   | Tenant plugin misses aggregate/$lookup/raw driver           | §3.6 (three layers), §4                                           |
| 5   | Multi-org users / org switching                             | §2, §3.6, Phase 3 gate, E2                                        |
| 6   | Stale roles in JWT                                          | §3.6, §3.7                                                        |
| 7   | Refresh reuse detection vs concurrent tabs                  | §3.7                                                              |
| 8   | Redundant double-submit CSRF; Next 16 `proxy.ts` rename     | §3.3, §1, §3.9                                                    |
| 9   | Nonce CSP vs brand colour; dynamic rendering cost           | §3.9, §3.12, §9                                                   |
| 10  | RSC untestable in RTL; jsdom contrast                       | §4, §3.11                                                         |
| 11  | Observability too late                                      | §3.10, Phase 2                                                    |
| 12  | LocalStack auth/entitlements; NAT and Atlas networking cost | §8                                                                |
| 13  | Memoisation vs React Compiler ordering                      | Phase 5                                                           |
| 14  | MFA in two places                                           | §3.7, §6 (E8 only), Phase 7                                       |
| 15  | No SaaS plans/billing                                       | §2, E6, Phase 4                                                   |
| 16  | No account deletion / data export                           | §3.9, E7, Phase 7                                                 |
| 17  | GraphQL vs zod drift                                        | §3.4, §4, §9                                                      |
| 18  | Subscriptions need a shared bus                             | §3.13, S2                                                         |
| 19  | No effort estimate / cut line                               | §5                                                                |
| —   | Scope: too broad                                            | Phases merged to 0–7; Cognito and subscriptions are stretch S1/S2 |

---

## 11. Decisions (resolved 2026-10-28 — all recommendations accepted)

1. **Auth**: ADR-0003 (hand-rolled, Cognito as stretch) — accept?
2. **Hosting**: ECS Fargate for web and API (recommended) or Amplify Hosting for web?
3. **Database**: MongoDB Atlas (recommended) or DocumentDB?
4. **LocalStack**: OK to use a Hobby token (non-commercial use only)? If this may become
   commercial, say so and CI will use the in-memory fakes instead.
5. **Name**: keep "Ledgerly"?
6. **Repo**: create an empty repo (e.g. `kaustubh007/ledgerly`); this session cannot create one.
