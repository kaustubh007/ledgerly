# Phase 1 — Foundation: what was built and what to learn from it

Phase 1 has no UI and no API. It builds the ground everything else stands on: a strict
TypeScript monorepo, a pure domain model for money and invoices, architecture rules a machine
enforces, and a local stack (MongoDB replica set + tracing) that later phases rely on.

## 1. The monorepo

```
packages/config   shared tsconfig, ESLint and Vitest presets
packages/domain   Money, Currency, Quantity, invoice state machine — zero dependencies
apps/             empty; rules for api/ and web/ already exist
```

**pnpm workspaces** link `@ledgerly/*` packages to each other without publishing. **Turborepo**
runs `build`, `lint`, `typecheck` and `test` across packages in dependency order and caches
results: run `pnpm check` twice and the second run is almost instant.

### Things to study here

- **`exports` + a custom condition.** Open `packages/domain/package.json`:

  ```json
  ".": { "@ledgerly/source": "./src/index.ts", "types": "./dist/index.d.ts", "default": "./dist/index.js" }
  ```

  Tooling that knows the `@ledgerly/source` condition (TypeScript via `customConditions`, Vitest
  via `resolve.conditions`) reads the `.ts` source. Everything else gets the build. That is how
  tests never run against a stale `dist/`. The Next.js app in Phase 3 will use the same trick.

- **Strictness flags beyond `strict`.** Read `packages/config/tsconfig.base.json` and look up
  each of these: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`, `erasableSyntaxOnly`, `isolatedDeclarations`. Exercise: turn
  `noUncheckedIndexedAccess` off and see which line in `money.ts` stops needing its `= ''`
  defaults, then explain why the default was the safer code.

- **Why no `enum`.** `erasableSyntaxOnly` means every TypeScript-only construct can be erased
  without changing behaviour, so Node 24 can run the source directly. `enum` generates runtime
  code, so it is banned. `InvoiceStatus` shows the replacement: a `const` object plus a type
  derived from its values.

- **Pinned versions that are not `latest`.** TypeScript 6 and GraphQL 16 are held by peer
  ranges (see `CLAUDE.md`). `strictPeerDependencies: true` makes a violating install fail
  rather than warn. This was tested: bumping TypeScript to 7.0.2 fails `pnpm install`.

## 2. Money

`packages/domain/src/money/money.ts`. Read it top to bottom; it is short.

- **Integer minor units in a `bigint`.** `0.1 + 0.2 !== 0.3` in JavaScript, so a `number` can
  never hold money. Cents, fils and yen are integers; the currency says how many digits after
  the point (`USD` 2, `JPY` 0, `KWD` 3).
- **The range is int64**, because that is what MongoDB stores. `bigint` never overflows on its
  own, so the class enforces the range and throws `MoneyOverflowError`, never wraps or clamps.
- **No conversion from `number`, no division.** `Money.parse('12.30', USD)` takes a string and
  refuses extra precision instead of rounding it away. Splitting money three ways is an
  _allocation_ problem (who gets the extra cent?), not a division, and gets its own function when
  a feature needs it.
- **One rounding function.** `multiplyAndRound(ratio)` multiplies by an exact fraction and
  rounds once, **half-to-even** (banker's rounding): 2.5 → 2, 3.5 → 4. Half-up always pushes
  ties upward, which drifts across thousands of line items; half-even cancels out.
- **Formatting stays exact.** `toDecimalString()` gives `"9007199254740993.12"` and
  `Intl.NumberFormat` accepts that string, so no float is ever involved. A test proves it with a
  value beyond `Number.MAX_SAFE_INTEGER`.

Exercise: write `allocate(money, ratios)` that splits an amount by weights so the parts always
sum to the original. Use property-based tests to prove it.

## 3. The invoice state machine

`packages/domain/src/invoice/invoice.ts`.

```
DRAFT ──send──▶ SENT ──pay (part)──▶ PARTIALLY_PAID ──pay (rest)──▶ PAID
  │               │                        └──pay (part)──┘
  └──void──▶ VOID ◀──void──┘
```

- **The table is the source of truth.** `ALLOWED` lists the legal actions per status, and every
  operation calls `guard` first. The test suite checks all 25 status × action combinations
  against the table, plus a test pinning the table itself. Mutation check done during the
  phase: adding `VOID` to `PARTIALLY_PAID` fails the table test.
- **Two kinds of failure.** A user can try to pay a paid invoice; that is a normal outcome,
  returned as `{ ok: false, error: { code: 'INVALID_TRANSITION', ... } }`. Adding USD to EUR
  inside the domain is a bug, so it throws. The first kind becomes GraphQL `userErrors` in
  Phase 2; the second becomes a 500 with a trace id.
- **Immutability.** Every operation returns a new frozen invoice. React (Phase 3+) relies on the
  same idea: a new object means "changed".
- **What the domain does _not_ do.** It decides _whether_ a payment is legal for the invoice as
  read. It cannot stop two payments from being read at the same time; that is the MongoDB
  transaction in Phase 2 (ADR-0002). Keep that boundary in mind.

## 4. Testing

- **Example tests** (`it.each` tables) pin the specific cases a reviewer will ask about:
  half-even ties, JPY and KWD, the int64 edges.
- **Property-based tests** (`fast-check`) state rules and let the library search for a
  counter-example: addition is commutative; `parse(toDecimalString(m))` gives back `m`; rounding
  is never more than half a unit off; _no sequence of payments can make `paid > total`_. When
  one fails, fast-check shrinks the input to the smallest failing case.
- **100 % branch coverage is a gate for the domain only.** It is small, pure, and every branch is
  a business rule. It is not a target for UI code.
- **Coverage is not proof.** During the phase the rounding was deliberately broken (always round
  away from zero); 6 tests failed. Do this yourself with any rule you add.

## 5. Architecture rules a machine checks

`.dependency-cruiser.cjs` turns `CLAUDE.md` rules into CI failures:

| Rule                                 | Meaning                                                               |
| ------------------------------------ | --------------------------------------------------------------------- |
| `domain-is-pure`                     | `packages/domain` imports nothing outside itself, not even `node:fs`  |
| `web-never-touches-the-database`     | `apps/web` cannot import `apps/api`, `mongoose` or `mongodb`          |
| `raw-driver-only-in-data-layer`      | only `apps/api/src/data/` may import `mongodb` (tenant guard layer 3) |
| `no-circular`, `not-to-unresolvable` | hygiene                                                               |

Each rule was proved to fire with a deliberately violating file before being trusted.

## 6. Local stack

`make up` starts MongoDB 9 as a **single-node replica set** (transactions need one), an
OpenTelemetry collector, and Jaeger. `make smoke` proves: the node is `PRIMARY`; a two-collection
transaction commits; the collector is healthy; a span posted over OTLP/HTTP shows up in Jaeger
(open http://localhost:16686). CI runs the same two commands.

LocalStack is defined behind the `aws` profile (`make up-aws`) and needs a free Hobby token. It
has not been exercised yet; nothing calls AWS until Phase 2 (email via SES) at the earliest.

## 7. Agile

The backlog in `PLAN.md` §6 is ready to become GitHub Issues. That was not done in this phase:
the GitHub integration was not connected in the working session. It is a ten-minute manual task
or the first thing to do when the integration is available.

## 8. Retro

- **Went well:** checking versions against npm and Docker Hub before writing code caught two
  peer-range traps and found MongoDB 9. Testing each architecture rule against a deliberate
  violation caught that `apps/` had to exist for dependency-cruiser to run.
- **Didn't:** the first build failed on `isolatedDeclarations` (a derived type needed an
  explicit annotation), and a stale `.tsbuildinfo` made a later build silently skip files.
  Fixed by keeping `tsBuildInfoFile` inside `dist/` so cleaning one cleans both.
- **One change for Phase 2:** write the tenant-leak test suite _before_ the first resolver, so
  every resolver is born inside it.

## 9. Read next

- _Designing Data-Intensive Applications_, ch. 7 (transactions): the background for ADR-0002.
- MDN: `BigInt`, `Intl.NumberFormat` (`format` with decimal strings).
- fast-check docs: "Properties" and "Shrinking".
- TypeScript handbook: Modules reference (`nodenext`, `exports`, conditions).
