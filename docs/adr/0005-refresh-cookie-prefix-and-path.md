---
status: accepted
date: 2026-10-28
---

# Refresh cookie is `__Secure-rt` on path `/graphql/auth` (amends ADR-0003)

## Context and Problem Statement

ADR-0003 names the refresh cookie `__Host-rt` *and* scopes it to the refresh route. Browsers
reject that combination: a `__Host-` cookie must have `Path=/` (RFC 6265bis §4.1.3.2). Found
while implementing Phase 2. Which property gives way?

## Decision Drivers

* The refresh token must not be sent with every GraphQL request (smaller exposure, ADR-0003).
* The cookie must stay host-only (no `Domain`), Secure and HttpOnly.
* The refresh endpoint must stay inside the `/graphql*` CloudFront behaviour (ADR-0001).

## Considered Options

* A. `__Secure-rt`, `Path=/graphql/auth`, no `Domain`, `SameSite=Strict`.
* B. `__Host-rt`, `Path=/`, sent with every request.

## Decision Outcome

Chosen option: **A**. Everything else in ADR-0003 stands.

* `__Secure-` still requires `Secure`; omitting `Domain` keeps the cookie host-only, which is
  what `__Host-` would have guaranteed. The difference: `__Secure-` does not *forbid* a
  `Domain` attribute, so the guarantee is ours to keep (one place sets it:
  `apps/api/src/features/identity/cookies.ts`).
* Refresh and logout are REST routes at `POST /graphql/auth/refresh` and
  `POST /graphql/auth/logout`, under the existing `/graphql*` route of ADR-0001, and require an
  `x-ledgerly-csrf` header.
* `SameSite=Strict` (the access cookie stays `Lax`): refresh is always a same-site `fetch`.

### Consequences

* Good: the refresh token travels only to the two routes that need it.
* Bad: a little less protection from the prefix than `__Host-` would give; compensated by a single
  cookie-setting function with a test asserting the path.
