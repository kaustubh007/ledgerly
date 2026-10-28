---
status: accepted
date: 2026-10-28
---

# Serve web and API from one origin behind CloudFront

## Context and Problem Statement

Ledgerly has a Next.js web app and a separate Apollo Server API. The browser, React Server
Components, and Route Handlers all need to call the API with the user's session. How does a
request reach the API, and where do session cookies live?

## Decision Drivers

* Session tokens must be `httpOnly` cookies, never readable by JS.
* No CORS configuration to get wrong.
* Server-rendered pages must call the API as the user, not as a service.
* Dev must behave like prod.

## Considered Options

* A. One origin; CloudFront path-routes `/graphql*` to the API.
* B. API on its own subdomain (`api.ledgerly.example`), called cross-origin from the browser.
* C. All browser traffic proxied through Next.js Route Handlers (BFF), API private.

## Decision Outcome

Chosen option: **A**, because cookies stay first-party with `SameSite=Lax`, there is no CORS,
and there is no extra Node hop for every browser query.

* Browser Apollo Client uses the relative URL `/graphql`.
* RSCs and Route Handlers call the API over the **internal** ALB, forwarding the incoming
  `Cookie` and `traceparent` headers. They hold no credentials of their own.
* Local dev reproduces the routing with Next.js `rewrites` for `/graphql`.
* Cookies use the `__Host-` prefix (`Secure`, `Path=/`, no `Domain`).

### Consequences

* Good: first-party cookies, no CORS, Apollo `csrfPrevention` + `SameSite=Lax` suffice for CSRF.
* Good: one trace spans browser → web → API.
* Bad: CloudFront must not cache `/graphql` (cache policy `CachingDisabled`, all headers and
  cookies forwarded to that behaviour).
* Bad: the API is reachable from the internet through CloudFront, so the WAF, depth/complexity
  limits, and rate limits apply to it directly.

## Pros and Cons of the Options

### B. Separate API subdomain

* Good: independent scaling and caching policy per hostname.
* Bad: cookies need `Domain=.ledgerly.example`, losing the `__Host-` protection; CORS with
  credentials must be configured exactly; preflight on every mutation.

### C. BFF proxy for everything

* Good: API fully private.
* Bad: every browser query pays an extra Node hop and doubles the code paths for
  streaming and subscriptions; Next.js becomes a throughput bottleneck.
