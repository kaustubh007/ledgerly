.PHONY: admin staff up up-aws down reset ps smoke smoke-api env api web e2e check

up: ## MongoDB (replica set), OpenTelemetry collector, Jaeger
	docker compose up -d --wait mongo otel-collector jaeger

up-aws: ## everything above plus LocalStack (needs LOCALSTACK_AUTH_TOKEN)
	docker compose --profile aws up -d --wait

down:
	docker compose --profile aws down

reset: ## also deletes the database volume
	docker compose --profile aws down -v

ps:
	docker compose ps

check:
	pnpm check

smoke: ## verifies replica set, transactions, and tracing end to end
	./scripts/smoke-local-stack.sh

env: ## creates .env from .env.example with freshly generated dev keys (never overwrites)
	@test -f .env && echo ".env exists; leaving it alone" || \
	  { cp .env.example .env && node apps/api/src/scripts/generate-keys.ts >> .env && echo "wrote .env"; }
	@# Keys added in later phases are appended to an existing .env, never replacing a value.
	@grep -q '^TOTP_ENCRYPTION_KEY=' .env || \
	  { node apps/api/src/scripts/generate-keys.ts | grep '^TOTP_ENCRYPTION_KEY=' >> .env && echo "added TOTP_ENCRYPTION_KEY to .env"; }

api: ## runs the API with watch mode and tracing (needs `make up` and `make env`)
	pnpm --filter @ledgerly/api dev

smoke-api: ## with the API running: proves one request is traced end to end in Jaeger
	./scripts/smoke-api.sh

web: ## the Next.js app on http://localhost:3000 (needs the API: `make api`)
	pnpm --filter @ledgerly/web dev

admin: ## the admin console on http://localhost:5173 (needs the API: `make api`)
	pnpm --filter @ledgerly/admin dev

staff: ## creates an OPS staff member: make staff EMAIL=you@ledgerly.example (prints a password)
	@test -n "$(EMAIL)" || { echo "usage: make staff EMAIL=you@ledgerly.example [ROLE=OPS|SUPPORT]"; exit 1; }
	pnpm --filter @ledgerly/api staff:create --email "$(EMAIL)" --role "$(or $(ROLE),OPS)"

e2e: ## builds everything and runs Playwright against a fresh e2e database (stop `make api`/`make web` first)
	pnpm build
	pnpm --filter @ledgerly/web e2e
