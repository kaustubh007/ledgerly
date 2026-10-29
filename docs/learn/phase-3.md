# Phase 3 — The web shell: Next.js App Router, RSC, Redux, Apollo

Phase 3 builds `apps/web`: a signed-in, multi-organisation shell around the Phase 2 API. Few
features (dashboard totals and a customer list), but every piece the rest of the app will hang
on: routing, server and client rendering, data loading, session handling, global UI state,
translations and accessibility.

```
apps/web/src/
  app/[locale]/              routes (App Router); [locale] is the root segment
    (auth)/sign-in, sign-up  route group: shares a layout, adds nothing to the URL
    o/                       picks an organisation
    o/[orgSlug]/             the app: layout (Server Component) + pages
  features/                  auth forms, shell (header, nav, org switcher, toasts), dashboard, customers
  lib/apollo/                rsc.ts (server client), ApolloWrapper.tsx (browser client), links.ts
  lib/auth/                  refresh.ts (single-flight refresh), RestoreSession.tsx, paths.ts
  store/                     Redux: makeStore, StoreProvider, slices, middleware
  i18n/, messages/           next-intl routing and en/de/ar messages
  proxy.ts                   locale negotiation (Next 16's name for middleware.ts)
  instrumentation.ts         OpenTelemetry for the web server
```

Run it: `make up && make env && make api`, then `make web`, then open http://localhost:3000.

## 1. Server Components and client components

Every file under `app/` is a **Server Component** unless it starts with `'use client'`. Server
Components run only on the server, can be `async`, can read cookies, and send no JavaScript to
the browser. The dashboard (`app/[locale]/o/[orgSlug]/page.tsx` → `CurrencyTotals`) is one: its
table arrives as HTML.

**Client components** (`'use client'`) are rendered on the server too (for the first HTML), then
**hydrated** in the browser, where they handle events and state: forms, the org switcher, toasts.

The rule of thumb used here: fetch on the server, interact on the client. Props flow from server
to client components; they must be serialisable (no functions, no class instances).

Exercise: add `console.log('render')` to `CurrencyTotals` and to `ThemeToggle`, load the
dashboard, and see where each log appears (terminal or browser).

## 2. Layouts, route groups, and parallel rendering

`app/[locale]/o/[orgSlug]/layout.tsx` wraps every page of an organisation. It asks the API who
the user is and what the organisation is, then mounts the shell. **Layouts and pages render in
parallel**: the page's query does not wait for the layout's verdict. That is why page queries use
`errorPolicy: 'all'`: when the layout decides "restore the session" or "404", the page's own
query fails too, harmlessly. Found by reading the server log of a passing test run.

`(auth)` is a **route group**: the parentheses keep it out of the URL but let sign-in and sign-up
share a layout.

## 3. Data: three ways to load it

| Where                                                | How                                                                                                                  | Example                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Server Component, render once                        | `await query({ query, context: forOrg(slug) })`                                                                      | dashboard                   |
| Server Component starts it, client component owns it | `<PreloadQuery>{(queryRef) => <List queryRef={queryRef} />}</PreloadQuery>` + `useReadQuery` / `useQueryRefHandlers` | customers, with "load more" |
| Client component, after an interaction               | `useMutation`                                                                                                        | sign-in, sign-up            |

The server Apollo client (`lib/apollo/rsc.ts`) forwards **only** the access cookie. The browser
Apollo client calls `/graphql` on its own origin (a Next rewrite in dev, CloudFront in prod) with
three links: refresh-on-401, `x-org` from the URL, HTTP.

**Guard that paid off:** the browser client's server-side twin throws if a client component
fetches during SSR (there are no browser cookies there). It caught that `PreloadQuery` with plain
children only warms the _browser_ cache; the SSR render was silently fetching and failing, and
Next quietly re-rendered on the client. The tests passed throughout; the log did not.

## 4. Sessions in the browser

The access cookie lives 10 minutes. Three cases:

- A client query gets `UNAUTHENTICATED` → `refreshOnUnauthenticatedLink` refreshes once (shared
  with every other request) and retries once.
- A page load finds no user on the server → `RestoreSession` refreshes from the browser (only it
  can send the refresh cookie, ADR-0005) and re-renders, or goes to sign-in.
- Several tabs at once → a Web Lock lets one tab call the server; a BroadcastChannel tells the
  others it is done. Sign-out is broadcast the same way.

E2E proves it: deleting the access cookie and reloading lands on the page, with a new cookie.

## 5. Redux Toolkit, and why it is small here

`store/store.ts` exports `makeStore`, a **factory**. `StoreProvider` calls it once per mount
(`useState(() => makeStore(...))`): one store per server request, one per browser page load. A
module-level store would be shared by every request the Node process serves, leaking one user's
state into another's HTML. `StoreProvider.test.tsx` shows two providers do not share state.

- `ui`: theme, mobile navigation. `toasts`: notifications (`prepare` makes ids so the reducer
  stays pure). `session`: a _view_ of who is signed in, filled by the server. Never trusted.
- **Listener middleware** (`middleware/preferences.ts`): when the theme changes, write a cookie
  and apply `data-theme`. Side effects in one place, not in reducers, not in every component.
- **Custom middleware** (`middleware/analytics.ts`): sees every action, forwards an allowlist of
  action _types_ to a sink, and can never break dispatch.

Server data is _not_ in Redux: Apollo owns it. The Phase 5 admin console does the opposite with
RTK Query, on purpose.

## 6. Forms

`SignInForm` uses react-hook-form with the **same zod schema the API validates with**
(`@ledgerly/validation`), so client and server agree on the rules. Errors (client-side zod
issues and server `userErrors`) are translated **by code**, never by showing server English.
Each error is tied to its input with `aria-describedby` and `aria-invalid`, and focus moves to
the first invalid field.

`?next=` after sign-in goes through `safeNext`: only same-site paths, so the sign-in page cannot
be used as an open redirect (`//evil.example`, `/\evil.example` are refused; tested).

## 7. Internationalisation and accessibility

- `/en`, `/de`, `/ar`; `<html lang dir>` per locale; Arabic is right-to-left from the first
  screen. CSS uses logical properties (`margin-inline`, `inset-inline-start`), so no RTL
  stylesheet exists or is needed.
- ICU plurals: Arabic has six plural categories (`فاتورتان` is "two invoices"); a test formats
  every locale.
- Skip link, landmarks (`banner`, `navigation`, `main`), `aria-current="page"` in the nav,
  `aria-expanded` on the menu button, a live region for toasts (present before any toast,
  because a region created with its content is often not announced).
- axe runs in every component test (no colour contrast in jsdom) and on real pages in Playwright
  (with contrast).

## 8. Testing

| Tier                                      | Count | What                                                                                                                  |
| ----------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| Unit/component (Vitest, jsdom, RTL)       | 58    | slices, middleware, store-per-request, refresh coordination, Apollo links, forms, shell, translations                 |
| End-to-end (Playwright, real API + Mongo) | 7     | sign-up, **two orgs in two tabs**, session restore, cross-tab sign-out, sign-in + `next`, foreign org 404, RTL/German |

The Phase 3 gate is the second E2E test: one user, two tabs, two organisations, each tab showing
only its own organisation's customers while the other is used.

## 9. Retro

- **Went well:** writing the Playwright test before the unit tests (the Phase 2 retro's one
  change) found real integration problems (SSR fetching, rate limits on reused databases) that
  unit tests could not. Builds and E2E passed on the first full run.
- **Didn't:** the lint stack Next.js ships does not support ESLint 10 yet; a passing test suite
  hid a server-side failure that only the log showed; two unit tests found real bugs (same-
  millisecond refresh skip, unhandled rejection on offline sign-out).
- **One change for Phase 4:** fail the E2E run if the web server logs an error (`⨯`), so "tests
  pass but the server is unhappy" cannot happen again.

## 10. Read next

- Next.js docs: "Server and Client Components", "Layouts and Pages", "Linking and Navigating".
- React docs: `use client`, Suspense, `useTransition`.
- Apollo Client docs: "Next.js App Router" integration, `useReadQuery`, link chains.
- Redux docs: "Usage with Next.js" (store per request), `createListenerMiddleware`.
- WAI-ARIA Authoring Practices: Disclosure pattern; MDN: Web Locks API, BroadcastChannel.
