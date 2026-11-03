# Phase 5 — The admin console: platform scope, staff TOTP, React Router and RTK Query

Phase 5 builds the tool Ledgerly's own support staff use: find an organisation, see its plan,
usage and health, suspend it, change its plan, sign a user out everywhere, read the audit log.
It is a separate app on a separate origin, with a separate schema and separate staff accounts
(ADR-0004). It teaches two things the tenant app could not: how to cross tenant boundaries
safely, and the other half of the React brief, a plain SPA with React Router and RTK Query.

```
apps/api/src/admin/          the admin API: staff auth, org reads and OPS commands, audit
  staff/                     staff, sessions, MFA challenges, TOTP, cookies
  organizations/             search, detail, suspend, change plan, revoke sessions
  audit/                     the append-only audit log
  graphql/                   the second schema's resolvers and codegen output
  platform-access.ts         the only tenant reads staff may make
apps/api/src/context/platform-scope.ts   runAsPlatform()
apps/api/src/data/platform-access.ts     the allowlist the tenant guard consults
packages/graphql/schema/admin/           the admin schema (no invoice or customer types at all)
apps/admin/src/
  routes.tsx                 the route tree: actions, middleware, loaders, lazy routes
  api/                       RTK Query: GraphQL base query, endpoints, loader helpers
  store/                     slices (entity adapters), listener and custom middleware
  features/                  auth, layout, organizations, audit
packages/ui/                 design tokens and base styles shared by web and admin
```

Run it: `make up && make env && make api`, then `make staff EMAIL=you@ledgerly.example` (prints
a password) and `make admin`. Open http://localhost:5173 and add the setup key to any
authenticator app.

## 1. Crossing tenants on purpose: the platform scope

The tenant guard (Phase 2) makes it impossible to read another organisation's data. Staff need
to, a little. The design keeps the hole as small and visible as possible:

- `runAsPlatform({ staffId, reason }, fn)` marks a block of code as "staff reading across
  tenants". Only `src/admin/` may import it (dependency-cruiser).
- Inside it, the guard admits **only** reads the admin module registered (`Customer` counts,
  `Invoice` counts and one aggregate, `Invitation` counts), and only when the query **names one
  organisation itself**. Nothing is injected, so a query that forgets its `orgId` throws instead
  of reading everything.
- Every admin request writes an audit entry; OPS actions also need a written reason.

Read `data/tenant-guard.ts` (`platformRead`) and its tests: "still refuses an unregistered
operation", "a read across organisations", "a write". The schema helps too: the admin schema has
no `Invoice` or `Customer` type, so no resolver could return one.

Exercise: add `allowPlatformReads('Payment', ['find'])` and write the admin field that would
use it. Then list everything you would need to justify in `DECISIONS.md`.

## 2. A second identity: staff sign-in with TOTP

Staff are not tenant users with a flag. A flag on a tenant account is one bug away from giving a
tenant admin powers. Staff have their own collection, cookie (`__Host-adm`), middleware and
schema, and the two never meet (the admin tests prove each API rejects the other's session).

Signing in is always two steps:

1. Password. Rate-limited, same answer for a wrong password and an unknown email (timing too).
   The step's state lives in a 5-minute HttpOnly cookie, never in JavaScript.
2. A TOTP code: HMAC-SHA1 of the current 30-second window, keyed by a secret shared once with
   the authenticator app. The first sign-in enrols (shows the secret; the first valid code
   confirms the app has it) and issues ten one-time recovery codes.

Details that make it sound, each with a test:

- **Replay:** a code is valid for its 30-second window (±1 for clock drift). The server remembers
  the last window used and only moves forward, atomically, so the same code never works twice.
- **Attempts:** five per challenge, counted in the same update that reads the challenge.
- **Secrets at rest:** AES-256-GCM with a key from configuration; the database alone is not
  enough to generate codes.
- **Sessions:** 8 hours however active, 30 minutes idle, revocable, role read on every request.

Exercise: in `test/admin.test.ts`, read "asks for a code, accepts it once, and refuses the same
code again". Remove `afterTimeStep` from `staff-auth.service.ts` and see which test fails.

## 3. React Router data mode

The tenant app's routing is the file system. Here routes are data (`routes.tsx`), and each one
can say how its data is loaded and how its forms are handled:

| Feature        | Where                         | What it does                                                        |
| -------------- | ----------------------------- | ------------------------------------------------------------------- |
| `action`       | `/sign-in`, `/sign-in/verify` | `<Form method="post">` posts to it; it returns errors or a redirect |
| `middleware`   | the layout route              | the guard: no staff session → `/sign-in?next=…`                     |
| `loader`       | list, detail, audit           | starts the page's request before rendering                          |
| `lazy`         | detail, audit                 | the page's code is a separate chunk, loaded on first visit          |
| `errorElement` | layout and its children       | a 404 or a failure renders here, inside the layout                  |
| search params  | list, audit                   | filters and page cursor live in the URL                             |

**A bug the tests found:** the guard was first a loader. Loaders of nested routes run **in
parallel**, so the page's loader asked the API for organisations at the same time as the guard
asked "who am I?". The API said `UNAUTHENTICATED`, and that redirect raced the guard's. Route
middleware runs before any loader, which is exactly what a guard needs.

Exercise: in `routes.tsx`, change `middleware: [requireStaff(store)]` back to a loader and run
`src/features/auth/signIn.test.tsx`.

## 4. RTK Query: server data in Redux

The tenant app keeps server data in Apollo's normalised cache. The console keeps it in Redux
through RTK Query, on purpose, so you can compare:

|                   | Apollo (web)                         | RTK Query (admin)                                       |
| ----------------- | ------------------------------------ | ------------------------------------------------------- |
| Cache key         | each object's `__typename:id`        | endpoint + arguments                                    |
| After a mutation  | normalised objects update anywhere   | tags invalidate entries, or you patch them yourself     |
| Optimistic update | `useOptimistic` in the component     | `onQueryStarted`: patch, then `undo()` on failure       |
| Prefetch          | `PreloadQuery` in a Server Component | `store.dispatch(endpoint.initiate())` in a loader       |
| Devtools          | Apollo devtools                      | Redux devtools: every request is an action you can read |

Read `api/adminApi.ts`, `optimisticStatus`: one suspension patches the detail **and every
cached list page**, because RTK Query caches each list query separately. `selectCachedArgsForQuery`
finds them.

The base query (`api/baseQuery.ts`) is the whole transport: about 60 lines. GraphQL errors
become RTK Query errors with a code; `userErrors` stay data for the forms.

## 5. Redux that isn't server data

- **`createEntityAdapter`:** toasts and "Recently viewed" are normalised (`ids` + `entities`).
  The recent list keeps itself sorted and trimmed to five in the reducer.
- **`createSelector`:** `selectRecentOrganizations` returns the same array until its slice
  changes, so the sidebar does not re-render on unrelated actions (tested).
- **Listener middleware** (`errorToasts.ts`): reacts to actions with side effects. A failed
  request becomes a toast; opening an organisation adds it to "Recently viewed".
- **A hand-written middleware** (`sessionExpired.ts`): sees every action. When any request comes
  back `UNAUTHENTICATED`, it clears every cached answer and goes to sign-in. One place instead
  of every page.

## 6. Testing an SPA without a browser

`src/test/renderApp.tsx` renders **the real route tree** in `createMemoryRouter`, with **a real
store**, and MSW answering the API from a small in-memory fake (`fakeAdminApi.ts`). So a test
exercises the loaders, middleware, actions, lazy routes, RTK Query cache and middleware all at
once. Only the network is fake.

The best example is "rolls the optimistic status back, with a toast, when the server refuses":
the fake delays its answer by 200 ms, the test sees "Suspended" before the answer, then
"Active" and the toast after it.

| Tier                              | Count | New this phase                                                                 |
| --------------------------------- | ----- | ------------------------------------------------------------------------------ |
| Validation                        | 11    | admin inputs                                                                   |
| API                               | 187   | platform-scope guard tests, admin gate suite (25), contract for admin inputs   |
| Web                               | 78    | suspension banner, error codes in forms                                        |
| Admin (RTL + MSW + memory router) | 27    | sign-in and enrolment, list, detail, OPS actions, rollback, session, audit     |
| E2E (Playwright)                  | 12    | the gate: staff TOTP sign-in → find org → suspend with reason → tenant blocked |

Mutation checks this phase: removing the audit write, the suspension guard, TOTP replay
protection, the idle timeout, the optimistic rollback, the session middleware or the route guard
each turned a test red.

## 7. Security notes

- The admin build has no inline scripts, so production can send a plain
  `Content-Security-Policy: script-src 'self'` from CloudFront. Compare the tenant app, which
  needs per-request nonces because Next.js inlines scripts (§3.9).
- In development, localhost cookies ignore the port, so both apps' cookies reach both servers.
  They stay separate sessions because each API reads only its own cookie. In production the
  origins differ and the browser keeps them apart too.

## 8. Retro

- **Went well:** the API gate tests came first and caught a real bug (`Money.toString()` includes
  the currency code). The route tests caught the guard race on their first run. Every
  protection got a mutation check.
- **Didn't:** the admin tests failed under the full parallel run, not on their own; the cause was
  Testing Library's 1-second wait, not the app, and it took two attempts to find. MSW 3 and
  React Router 8 changed APIs (MSW's `graphql` entry point and unhandled-request option, React
  Router's middleware); reading their type definitions first was faster than guessing.
- **One change for Phase 6:** measure before optimising. Record React Profiler numbers for the
  invoice list before touching memoisation, as the plan's gate asks.

## 9. Read next

- React Router docs: "Data mode", "Middleware", "Lazy route discovery".
- Redux Toolkit docs: "RTK Query: Optimistic Updates", "Manual cache updates",
  `createEntityAdapter`, "Listener middleware".
- RFC 6238 (TOTP) and RFC 4226 (HOTP); OWASP Multifactor Authentication Cheat Sheet.
- MSW docs: "Node.js integration", "GraphQL".
- OWASP ASVS V2 (authentication) and V7 (logging), for what an audit log must record.
