# Ledgerly

A multi-tenant invoicing SaaS built in phases as a production-grade learning project.

- **New here?** Start with the [codebase tour](docs/ONBOARDING.md)
- **Plan and phases:** [PLAN.md](PLAN.md)
- **What each phase teaches:** [docs/learn](docs/learn)
- **Architecture decisions:** [docs/adr](docs/adr) · **Other decisions:** [DECISIONS.md](DECISIONS.md)

## Status

| Phase                            | State                                   |
| -------------------------------- | --------------------------------------- |
| 0 Plan                           | done                                    |
| 1 Foundation                     | done                                    |
| 2 API, data, auth, observability | done                                    |
| 3 Web shell                      | done                                    |
| 4 Core features                  | done                                    |
| 5–8                              | planned (5 = admin console, revision 3) |

## Getting started

Requires Node 24 LTS (`.nvmrc`) and Docker.

```bash
corepack enable
pnpm install
pnpm check      # format, lint, typecheck, tests with coverage, architecture rules
make up         # MongoDB replica set, OpenTelemetry collector, Jaeger (http://localhost:16686)
make smoke      # proves transactions and tracing work
make env        # creates .env with generated dev keys
make api        # the GraphQL API on http://localhost:4000/graphql
make smoke-api  # with the API running: one request, traced end to end in Jaeger
make web        # the Next.js app on http://localhost:3000 (needs `make api`)
make e2e        # Playwright against a fresh database (stop `make api`/`make web` first)
```

`make up-aws` also starts LocalStack (S3, SQS, SES, Lambda) and needs `LOCALSTACK_AUTH_TOKEN`
(free Hobby plan, non-commercial) in `.env`; see `.env.example`.

## Simulations

Deliberate stand-ins, named `*Simulator`:

- **`PaymentGatewaySimulator`** (`apps/api/src/features/payments/`) stands in for a card
  processor behind the `PaymentGateway` port. It charges invoice payments (`payInvoiceByCard`)
  and plan upgrades (`changePlan`). No real card data exists anywhere: the payment method is a
  test token. `pm_card_visa` and `pm_card_mastercard` succeed; `pm_card_declined` and
  `pm_card_insufficient_funds` are declined. Charges are idempotent per key (a different request
  under the same key is refused, as a real gateway would), can be refunded, and are kept in the
  global `simulatedcharges` collection so tests can see exactly what was charged.
