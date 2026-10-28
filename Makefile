.PHONY: up up-aws down reset ps smoke smoke-api env api check

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

api: ## runs the API with watch mode and tracing (needs `make up` and `make env`)
	pnpm --filter @ledgerly/api dev

smoke-api: ## with the API running: proves one request is traced end to end in Jaeger
	./scripts/smoke-api.sh
