# Phase 2 — The API: data, tenancy, auth, observability

Phase 2 builds `apps/api`: a GraphQL API over MongoDB that is multi-tenant, transactional where
money moves, authenticated with rotating refresh tokens, and traced end to end. There is still
no UI; the tests are the client.

```
apps/api/src/
  context/        AsyncLocalStorage request context (who is calling, which org)
  data/           connection, transactions, tenant guard (the only home of raw driver access)
  features/
    identity/     users, sessions, tokens, cookies, rate limits, auth service + resolvers
    organizations/ orgs, memberships, invitations
    customers/    CRUD + search + pagination
    invoices/     invoices, payments, counters, dashboard aggregation
    idempotency/  at-most-once mutations
    outbox/       emails written in the same transaction as their cause
  graphql/        schema assembly, scalars, errors, limits, pagination, context + DataLoaders
  http/           Express app, request context middleware, refresh/logout routes
packages/graphql   the SDL (single source of truth for API shape)
packages/validation zod input rules shared with the forms in Phase 3
```

Run it: `make up && make env && make api`, then open http://localhost:4000/graphql.

## 1. Schema-first GraphQL with codegen mappers

The schema lives in `packages/graphql/schema/tenant/*.graphql`. `pnpm --filter @ledgerly/api
codegen` generates resolver types; `codegen.ts` maps each GraphQL type to what its resolvers
_receive_: an `Invoice` resolver gets an `InvoiceRecord` (the database row), a `Money` resolver
gets the domain `Money`. So `Invoice.total` is a one-liner that builds `Money` from
`totalMinor` and the compiler checks it.

Study: open `src/graphql/__generated__/resolvers.ts`, find `InvoiceResolvers`, and see how the
parent type comes from the mapper.

**Errors, two kinds.** `UNAUTHENTICATED`/`FORBIDDEN`/`BAD_USER_INPUT` are GraphQL errors. Business
refusals (`OVERPAYMENT`, `EMAIL_TAKEN`) are `userErrors` in the payload, with a stable `code` and
a `field` path a form can attach the message to. Anything unexpected is logged in full and
returned as "Something went wrong on our side" with a `traceId` (`graphql/errors.ts`).

## 2. Tenancy: three layers, and AsyncLocalStorage

The request context (`context/request-context.ts`) is set once by the HTTP middleware and read
anywhere below without being passed: the tenant guard, the logger, the resolvers.

The guard (`data/tenant-guard.ts`) is a Mongoose plugin on every tenant schema:

1. every query gets `orgId` from the context, and refuses to run without one;
2. every aggregate gets a leading `$match`, and its `$lookup`s must come from `tenantLookup()`;
3. raw driver access is a lint error outside `src/data/`.

**Gotcha you will hit:** Mongoose queries are lazy. `Thing.find()` does nothing until awaited.
If you build it inside `runInTenant(...)` but await it outside, it runs with no organisation.
See the comment on `asA` in `data/tenant-guard.test.ts`.

**The gate:** `test/tenant-leak.test.ts`. A member of org A, with A selected, calls every query
and mutation aiming at B's ids; nothing of B's comes back or changes. Its last test reads the
schema and fails if any Query or Mutation field is not exercised, so a new resolver cannot slip
past it. Try it: add a field to the schema and run the suite.

## 3. Money and transactions (ADR-0002)

`recordPayment` reads the invoice, asks the domain whether the payment is legal, writes the
payment and updates the invoice — all inside one MongoDB transaction. Two concurrent payments
on the same invoice: one hits a _write conflict_ on the invoice document, the driver retries
it, and the retry sees the new balance.

`test/concurrency.test.ts` fires ten payments of 30.00 at a 100.00 invoice at once: exactly three
succeed. During the phase the transaction was removed on purpose and the test failed. That is
the experiment to repeat yourself.

**Idempotency** (`features/idempotency`): the client sends a UUID with each mutation. The first
request runs and stores its outcome in the same transaction; replays return it. Five identical
submissions in parallel record one payment.

**Invoice numbers** come from a per-org counter incremented inside the send transaction: if
sending fails, the number is not used. Twenty simultaneous sends get numbers 1–20, no gaps.

**Transactional outbox:** an email is a row written in the same transaction as its cause. A
retried transaction cannot send twice; a rolled-back one sends nothing.

## 4. Authentication (ADR-0003, ADR-0005)

Read `features/identity/auth.service.ts` top to bottom.

- Passwords: argon2id. Unknown emails still pay for a hash check (timing).
- Access token: a 10-minute EdDSA JWT holding only `sub` and `sid`, in `__Host-at`. Roles are
  never in it; the middleware loads membership per request, so a role change applies on the
  next request (tested).
- Refresh token: random, stored hashed, rotated on every use, in `__Secure-rt` on
  `/graphql/auth` only.
- Racing tabs: within 20 s, the previous token gets the _same_ successor (sealed with
  AES-GCM so the server can hand it out again).
- Theft: the previous token after 20 s, or any older one, revokes the whole session at once.
- The session is checked on every request, so revocation is immediate.

Exercise: in `test/auth.test.ts`, read "treats reuse after the grace window as theft". Then set
`REFRESH_GRACE_MS` to 0 and run "gives racing tabs the same successor": you have just logged a
user out for opening two tabs.

## 5. Observability

`make up`, `make env`, `make api`, then `make smoke-api`. One sign-up produces one trace in
Jaeger (http://localhost:16686): HTTP `POST` → GraphQL parse/validate/resolve → every MongoDB
command, down to `commitTransaction`. Every log line carries `requestId`, `userId`, `orgId` and
`traceId`, so a log line leads to its trace and back.

## 6. Testing

- **Real HTTP, real MongoDB.** `test/harness.ts` starts the app on a random port against a
  Testcontainers replica set, with a cookie jar that respects `Path` (so the refresh cookie's
  scoping is actually tested) and a movable clock (token expiry, grace windows, overdue).
- **Contract test** (`test/contract.test.ts`): every GraphQL input type has a zod twin with the
  same fields and the same required-ness.
- **Mutation checks done this phase:** removing the tenant guard, removing the aggregate
  `$match`, removing the payment transaction, and making a zod field optional each turned a
  suite red. A test you have never seen fail is a test you do not know works.

Coverage: 93 % lines, 77 % branches for the API (100 % for the domain).

## 7. Retro

- **Went well:** testing the tenant guard before building on it caught the lazy-query gotcha
  early. The concurrency tests passed first time, and failed when the transaction was removed.
- **Didn't:** returning Mongoose queries from resolvers broke every test (`Query was already
executed`); now a lint rule. Vitest had been resolving workspace packages to stale `dist/`
  since Phase 1 without anyone noticing. ADR-0003 specified an impossible cookie (ADR-0005).
- **One change for Phase 3:** write the first Playwright test against the real API before the
  first component, so the auth flow (refresh, two tabs) is tested in a browser, not just by
  the harness.

## 8. Read next

- MongoDB manual: "Transactions" → "In-progress transactions and write conflicts".
- OWASP: Authentication, Session Management, and Password Storage cheat sheets.
- RFC 6265bis §4.1.3 (cookie prefixes).
- GraphQL spec §5 (validation) — then re-read `graphql/limits.ts`.
- "Transactional outbox" (microservices.io).
