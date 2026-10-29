# Phase 4 — Core features: invoices, payments, plans

Phase 4 turns the shell into a product. A user can now create customers, draft an invoice,
send it (it gets its number), and get paid manually or by card. Plans limit how much a FREE
organisation can create, and an owner can upgrade or downgrade.

The theme of the phase is **doing a thing exactly once**: one payment for a double click, one
charge for a retried request, five customers for ten parallel creators.

```
packages/domain/src/billing/plans.ts      the plan catalogue, limits, upgrade/downgrade rules
apps/api/src/features/
  payments/      PaymentGateway port + PaymentGatewaySimulator, gatewayKey
  billing/       limits (checkCapacity, usage), changePlan, BillingEvent
  invoices/      payInvoiceByCard, customerId filter, touchLock
apps/web/src/
  components/form/   Field, SelectField, errors by code, useZodForm, formText
  lib/hooks/         useIdempotencyKey, usePermission, useToast, useMoney
  features/customers/ CustomerForm (create/edit), NewCustomer
  features/invoices/  InvoiceEditor (useReducer), filters (URL + useOptimistic), detail, payments
  features/billing/   BillingPanel: usage meters, plan cards, ChangePlanForm
apps/web/e2e/invoices.spec.ts   the gate
```

Run it: `make up && make env && make api`, then `make web`. Sign up, add a customer, open
Invoices → New. Pay by card with `pm_card_visa`, or with `pm_card_declined` to see a refusal.

## 1. TSX patterns used in this phase

- **Composition over configuration.** `Field`, `SelectField`, `TextAreaField` take `children`
  and a `hint`/`error`; they wire `id`, `aria-describedby` and `aria-invalid` once, so no form
  repeats it.
- **Render props** carry over from Phase 3 (`<PreloadQuery>{(ref) => …}</PreloadQuery>`).
- **Discriminated unions in props and state.** `lines.ts` actions are
  `{ type: 'add' } | { type: 'remove'; id } | { type: 'change'; id; field; value }`; TypeScript
  checks each `case` of the reducer.
- **Keys as a reset button.** The payment forms are rendered with `key={balance}`: when a
  payment changes the balance, React throws the old form away and the default amount is fresh.
  Cheaper and more honest than syncing state with an effect.

Exercise: remove `key` from the payment forms in `InvoiceDetail.tsx`, pay half an invoice, and
look at the amount field.

## 2. Hooks: built-in and custom

| Hook                | Where                   | Why                                                                          |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `useReducer`        | `InvoiceEditor`         | line items are a small state machine; the reducer is a pure, tested function |
| `useMemo`           | `InvoiceEditor` preview | recompute totals only when lines or currency change                          |
| `useActionState`    | payment and plan forms  | pending state, result and error from one async action, no hand-rolled flags  |
| `useOptimistic`     | payments list, filters  | show the intended state now; React drops it when the real state arrives      |
| `useTransition`     | filters                 | the URL change is a non-urgent update; the old list stays interactive        |
| `useIdempotencyKey` | every money mutation    | one key per intent, renewed only after a success                             |
| `usePermission`     | invoice actions, forms  | the domain's `can()` with the role from the session                          |

A **custom hook** is just a function that calls hooks. The rule that matters is the one that
makes them composable: no conditions around hook calls.

**Memoization, honestly:** `useMemo` is used once here, because domain `Money` arithmetic over
every line on every keystroke is measurable. React 19's compiler is not enabled. Most
components need nothing.

## 3. Optimistic UI, two ways

1. **Apollo cache update** (`CustomerForm`): after `createCustomer`, `cache.updateQuery` puts
   the new customer at the top of the list that is already on screen. No refetch.
2. **React `useOptimistic`** (`InvoiceDetail`): the payment appears in the list as "pending"
   the moment the form submits. If the server refuses it, the optimistic row disappears on its
   own when the action ends, and the error shows on the form.

The filters use `useOptimistic` for a different reason. During a navigation transition,
`useSearchParams()` still returns the _old_ URL until the new page commits. Two quick filter
changes built two URLs from the same stale base, and the first change was lost. The optimistic
query string is the "what the URL is about to be" value.

## 4. Exactly once

### A double click (idempotency keys)

The form owns a UUID (`useIdempotencyKey`). Both clicks send the same key; the API runs the
first and replays its stored outcome for the second (Phase 2). E2E clicks "Record payment"
twice and checks there is one payment.

### A charge (external side effects)

A card charge cannot sit inside a MongoDB transaction: the driver retries transactions on a
write conflict, and a charge retried is a customer charged twice. So `payInvoiceByCard` does:

```
storedOutcome(key)  → already done? return it (no gateway call)
domain dry run      → would this payment be legal right now?
gateway.charge      → outside any transaction, with gatewayKey(key, invoice, amount, card)
idempotent(record)  → transaction: re-check, record payment, update invoice
   refused?         → gateway.refund, PAYMENT_REFUNDED
```

The last line is a **compensating action**: the saga pattern in miniature. The race test pays
the same invoice by card from two requests at once; one is recorded, the other is refunded.

Why `gatewayKey` is a digest of the key _and_ the parameters: a user whose card was declined
retries with another card from the same form, so the same key. A real gateway refuses a
different request under a used key. Hashing in the parameters makes "same request" replay and
"changed request" a new charge.

### Five customers (write skew)

FREE allows five customers. "Count, then insert" in a transaction looks safe and is not: ten
transactions each count four, each insert one, and none of their writes touch the same
document, so none conflicts. That is **write skew**, the anomaly snapshot isolation allows.

The fix is to make them conflict: `checkCapacity` first writes a lock document
(`touchLock('capacity:customers')`). Every creator writes it, so all but one hit a write conflict
and retry, and the retry sees the new count.

Exercise: comment out the `touchLock` line in `billing/limits.ts` and run
`pnpm --filter @ledgerly/api test billing`. Count the customers.

## 5. Plans

- The catalogue is data in the domain package (`PLANS`), so the API enforces it and the
  billing page renders it from the same source.
- Limits are checked where things are created: customers, invoices this month, seats (members
  plus open invitations).
- Downgrading keeps everything. The page warns which resources will be over the new limit;
  afterwards, only creating more is refused.
- Upgrades charge the new price through the gateway. No proration (see DECISIONS).

## 6. Server and client boundaries, again

The bug of the phase: the invoices page (a Server Component) imported `STATUSES` from a module
marked `'use client'`. On the server, everything exported from a client module is a
**client reference**, a placeholder to be resolved in the browser, not the array. The page
crashed. Worse, the customers page had been passing `CUSTOMER_PAGE_SIZE` from a client module
to `PreloadQuery` since Phase 3, so its variables had quietly been `{}`.

The fix is structural: constants live in `constants.ts` (no directive), and
`test/client-boundary.test.ts` fails if a `'use client'` module exports anything that is not a
component.

## 7. Accessibility and i18n in forms

- Every error is tied to its field (`aria-describedby`) and focus moves to the first invalid
  one. Errors are translated by code; the server's English never reaches the screen.
- Filters are a `<search>` landmark. Status badges carry text, not only colour.
- Destructive actions (Void) ask for confirmation in place, not in a modal.
- Usage meters are `<meter>` with a text label; "unlimited" is an ICU plural case (`=-1`).
- Money is formatted with `Intl.NumberFormat` in the UI locale (`useMoney`), from the integer
  minor units; never through a JS `number` holding the amount.

## 8. Testing

| Tier                        | Count | New this phase                                                                      |
| --------------------------- | ----- | ----------------------------------------------------------------------------------- |
| Domain                      | 160   | plans: limits, upgrade/downgrade, charges, over-limit                               |
| API (real Mongo, real HTTP) | 139   | billing (17): limits, write skew, plan changes, card payments, race refund, retries |
| Web unit (RTL + axe)        | 74    | line reducer, invoice editor and actions, customer form, client boundary            |
| E2E (Playwright)            | 11    | create → send → pay; double-submit; plan limit; URL filters                         |

The E2E run now also fails if the web server prints `⨯` or the API logs an error, the change
promised in the Phase 3 retro. It caught nothing new this phase, which is the point: it was
already clean when it switched on, and it will stay clean.

## 9. Retro

- **Went well:** the write-skew test was written before the fix and failed 3 out of 3. The E2E
  gate found the stale-form-default and lost-filter bugs, which unit tests could not see.
- **Didn't:** a Phase 3 bug (the client-reference constant) went unnoticed for a whole phase
  because the page still rendered. The web `codegen:check` had been failing since Phase 3; CI
  would have been red, and nobody could see CI from here. The plan named two simulators for one
  concept.
- **One change for Phase 5:** verify CI status on GitHub for every push, or say plainly that it
  could not be verified.

## 10. Read next

- React docs: `useActionState`, `useOptimistic`, "Preserving and Resetting State" (keys).
- Next.js docs: "Server and Client Components" → "Interleaving", and the `'use client'`
  directive reference.
- Martin Kleppmann, _Designing Data-Intensive Applications_, ch. 7: "Write Skew and Phantoms".
- Stripe docs: "Idempotent requests". microservices.io: "Saga".
- Apollo Client docs: "Reading and writing data to the cache" (`updateQuery`).
