# Ledgerly

A multi-tenant invoicing SaaS built in phases as a production-grade learning project.

- **Plan and phases:** [PLAN.md](PLAN.md)
- **What each phase teaches:** [docs/learn](docs/learn)
- **Architecture decisions:** [docs/adr](docs/adr) · **Other decisions:** [DECISIONS.md](DECISIONS.md)

## Status

| Phase        | State     |
| ------------ | --------- |
| 0 Plan       | done      |
| 1 Foundation | in review |

## Getting started

Requires Node 24 LTS (`.nvmrc`) and Docker.

```bash
corepack enable
pnpm install
pnpm check      # format, lint, typecheck, tests with coverage, architecture rules
make up         # MongoDB replica set, OpenTelemetry collector, Jaeger (http://localhost:16686)
make smoke      # proves transactions and tracing work
```

`make up-aws` also starts LocalStack (S3, SQS, SES, Lambda) and needs `LOCALSTACK_AUTH_TOKEN`
(free Hobby plan, non-commercial) in `.env`; see `.env.example`.

## Simulations

Deliberate stand-ins, named `*Simulator`, arrive in Phase 4: `PaymentGatewaySimulator` and
`BillingGatewaySimulator`. None exist yet.
