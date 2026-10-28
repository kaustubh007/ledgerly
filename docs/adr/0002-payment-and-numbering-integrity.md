---
status: accepted
date: 2026-10-28
---

# Transactions, idempotency keys, and send-time numbering for invoices and payments

## Context and Problem Statement

"Overpayment is rejected" is a check-then-write. Two concurrent `recordPayment` calls can both
pass the check. A double-clicked submit records two payments. Invoice numbers must be unique per
organisation and should not have unexplained gaps.

## Decision Drivers

* Correctness under concurrency, provable by a test.
* Safe retries from the client and the network.
* Accountants expect gapless, sequential numbers for issued invoices.

## Considered Options

* A. MongoDB multi-document transactions + idempotency keys + counter allocated at send time.
* B. Optimistic concurrency only (version field on the invoice, retry on conflict), number
  allocated at draft time.
* C. Single-document design: embed payments in the invoice and use one atomic update with a
  guard condition.

## Decision Outcome

Chosen option: **A**.

* MongoDB runs as a replica set in every environment (Atlas; `rs0` single node in Docker
  Compose and Testcontainers). Transactions require it.
* `recordPayment` runs inside `session.withTransaction`: read invoice, check status and balance
  in `packages/domain`, insert payment, update invoice `paidMinor` and status. Write conflicts
  are retried by the driver.
* Every state-changing mutation takes an `idempotencyKey` (UUID created when the form opens).
  `idempotency_keys` has a unique index on `(orgId, key)`, stores a payload hash and the
  response, TTL 24 h. Same key + same payload → original response. Same key + different
  payload → `IDEMPOTENCY_KEY_REUSED`.
* Invoice numbers are allocated in the **send** transaction with
  `counters.findOneAndUpdate({orgId, name:'invoice'}, {$inc:{seq:1}}, {upsert:true})`.
  Drafts have no number, so deleting a draft never leaves a gap. Unique index on
  `(orgId, number)` is the backstop. Voided invoices keep their number.

### Consequences

* Good: a concurrency test (N parallel payments summing to more than the balance) passes
  deterministically.
* Good: the client can retry any mutation safely.
* Bad: the per-org counter document is a write hotspot; acceptable at invoice-send volumes.
* Bad: replica set adds local setup and slightly slower test startup.

## Pros and Cons of the Options

### B. Optimistic concurrency

* Good: no transactions needed.
* Bad: payment insert and invoice update are still two writes; a crash between them leaves
  them inconsistent. Draft-time numbering leaves gaps.

### C. Embed payments

* Good: one atomic document update, no transaction.
* Bad: unbounded array growth; payments can't be queried or paginated independently; still
  needs idempotency and a counter.
