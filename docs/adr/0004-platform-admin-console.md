---
status: proposed
date: 2026-10-28
---

# Platform admin console on its own origin, schema and identity, with an audited platform scope

## Context and Problem Statement

Ledgerly staff need to support tenants: find an organisation, see its plan and health, suspend
it, change its plan, revoke sessions, read the audit log. That needs reads and a few writes
across tenants, and the tenant guard (PLAN §3.6) exists precisely to make cross-tenant access
impossible.

The console is also the project's vehicle for learning a plain React SPA with React Router and
Redux Toolkit/RTK Query, which the Next.js app does not teach.

How do staff get cross-tenant access without weakening tenant isolation for everyone else?

## Decision Drivers

* A tenant user must never be able to reach an admin capability, by bug or by attack.
* Cross-tenant access must be narrow, explicit in code, and audited.
* Staff see what support needs, not tenant business data.
* The console must be a separate SPA (Vite + React Router + RTK Query) for learning reasons.

## Considered Options

* A. Separate origin, separate Apollo Server instance and schema, separate staff identity,
  and an explicit `platform` request context usable only from the admin module.
* B. Admin pages inside the Next.js app, gated by a `isPlatformAdmin` flag on tenant users,
  using the tenant schema with extra admin fields.
* C. No console: staff use database tooling (Atlas UI, scripts) directly.

## Decision Outcome

Chosen option: **A**.

* **Origin.** `admin.ledgerly.example`, its own CloudFront distribution: the static Vite build
  from S3, `/admin/graphql` routed to the API. Cookies are `__Host-` cookies of that origin, so
  tenant and staff sessions are disjoint. Optional WAF IP allowlist.
* **Schema.** A second Apollo Server instance in the `api` service at `/admin/graphql`, with its
  own schema in `packages/graphql/schema/admin`. Admin types do not exist in the tenant schema.
* **Identity.** Staff live in their own collection, with their own login, mandatory TOTP,
  sessions of 8 h absolute / 30 min idle, and roles `SUPPORT` (read) and `OPS` (suspend,
  change plan, revoke sessions) loaded per request.
* **Platform scope.** Admin resolvers run inside `runAsPlatform({ staffId, reason }, fn)`,
  which sets `{ kind: 'platform', ... }` in AsyncLocalStorage. The tenant guard admits that
  context only for read models and commands the admin module registers; every other tenant
  model still throws. dependency-cruiser restricts imports of `runAsPlatform` to
  `apps/api/src/admin/`.
* **Audit.** Every admin read and write records staff id, action, target org and reason. `OPS`
  actions require a reason in the UI and the API.
* **Data minimisation.** The admin schema exposes counts, per-currency totals, plan, status and
  metadata. It has no invoice, customer or payment detail types and no impersonation.

### Consequences

* Good: a tenant-side bug cannot expose admin capabilities, because they are not in the tenant
  schema, origin or session.
* Good: every cross-tenant read is visible in code (`runAsPlatform`) and in the audit log.
* Good: the console exercises React Router data mode, RTK Query, entity adapters and Redux
  middleware in a real setting.
* Bad: a second CloudFront distribution, Apollo instance, login flow and SPA to maintain.
* Bad: two GraphQL client stacks in one repo (Apollo in web, RTK Query in admin). Accepted for
  learning; a product team would choose one.
* Bad: the platform scope is a deliberate exception to tenant isolation. Mitigated by the
  registration allowlist, import restriction, audit log, and dedicated tests (PLAN Phase 5 gate).

## Pros and Cons of the Options

### B. Admin inside the Next.js app

* Good: one app, one deploy, one login.
* Bad: a single flag on a tenant user becomes the most valuable thing to steal or mis-set;
  admin fields in the tenant schema are one missing check away from exposure; no React Router
  or RTK Query learning.

### C. Database tooling only

* Good: no code.
* Bad: staff get full, unaudited read access to all tenant data; no least privilege; nothing to
  learn about building internal tools.
