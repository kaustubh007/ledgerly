.PHONY: up up-aws down reset ps smoke check

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
