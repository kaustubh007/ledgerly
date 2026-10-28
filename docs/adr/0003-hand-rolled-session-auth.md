---
status: accepted
date: 2026-10-28
---

# Hand-rolled session authentication with rotating refresh tokens

## Context and Problem Statement

Ledgerly needs sign-up, login, sessions, email verification, password reset, and later MFA.
The project's goal includes learning authentication strategies, not only shipping them.

## Decision Drivers

* Learning value: every mechanism visible and tested.
* Tokens never readable by JavaScript.
* Role changes and session revocation take effect quickly.
* Replaceable later by a managed IdP without touching feature code.

## Considered Options

* A. Hand-rolled: argon2id, short-lived JWT access token, rotating opaque refresh tokens.
* B. Amazon Cognito with OAuth 2.1 Authorization Code + PKCE via the Next.js server.
* C. Auth.js (NextAuth) with a credentials provider.

## Decision Outcome

Chosen option: **A**, behind an `AuthProvider` port so **B** can replace it (stretch S1,
ADR-0004).

* Passwords: argon2id (`@node-rs/argon2`) with OWASP-recommended parameters.
* Access token: JWT (`jose`, EdDSA), 10 min, claims `sub` and `sid` only. Cookie `__Host-at`.
  Roles are **not** in the token; membership is loaded per request.
* Refresh token: 256-bit random, stored as SHA-256 hash, rotated on every use, cookie
  `__Host-rt`. Each session is a token family.
* Reuse detection with a **20 s grace window**: if a just-rotated token is presented again
  within the window, the server returns the same successor (kept encrypted with a server key
  for the window only) instead of revoking. Outside the window, reuse revokes the family and
  is written to the audit log.
* The browser serialises refreshes (one in-flight promise, `BroadcastChannel` across tabs), so
  the grace window is a backstop, not the main mechanism.
* Rate limits per IP and per account on login, reset, and verify. Generic error messages.
* TOTP MFA + recovery codes in Phase 7.

### Consequences

* Good: the learner implements and tests rotation, reuse detection, revocation, and CSRF
  reasoning first-hand.
* Bad: security-critical code we own; mitigated by a threat model, ZAP scan, and tests for
  each attack in the threat model.
* Bad: no social login until S1.

## Pros and Cons of the Options

### B. Cognito

* Good: managed MFA, social login, compliance burden carried by AWS.
* Bad: hides most of the mechanics the project is meant to teach; LocalStack emulation of
  Cognito is a paid entitlement.

### C. Auth.js credentials provider

* Good: less code.
* Bad: the credentials provider is deliberately limited by its maintainers (no built-in
  refresh rotation for credentials sessions); couples auth to Next.js while the API is a
  separate service.
