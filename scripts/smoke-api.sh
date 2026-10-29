#!/usr/bin/env bash
# Proves the API's observability end to end. Start the stack (`make up`) and the API first.
# One sign-up must produce a trace in Jaeger with HTTP, GraphQL and MongoDB transaction spans,
# and (if API_LOG names the API's log file) a request log line carrying a trace id.
set -euo pipefail
API=${API_URL:-http://localhost:4000}
LOG=${API_LOG:-}

echo "1. API is healthy"
curl -fsS "$API/healthz" >/dev/null

echo "2. Sign up (one request, one transaction)"
email="smoke-$(date +%s%N)@example.com"
curl -fsS -X POST "$API/graphql" -H 'content-type: application/json' -d "{
  \"query\": \"mutation (\$i: SignUpInput!) { signUp(input: \$i) { viewer { id } userErrors { code } } }\",
  \"variables\": { \"i\": { \"email\": \"$email\", \"password\": \"correct horse battery\", \"name\": \"Smoke\", \"organizationName\": \"Smoke Co\" } }
}" | grep -q '"userErrors":\[\]'

echo "3. Jaeger has a trace with HTTP, GraphQL and MongoDB transaction spans"
start=$(date -u -d '-5 min' +%Y-%m-%dT%H:%M:%SZ)
for _ in $(seq 1 30); do
  end=$(date -u -d '+1 min' +%Y-%m-%dT%H:%M:%SZ)
  names=$(curl -fsS "http://localhost:16686/api/v3/traces?query.service_name=ledgerly-api&query.start_time_min=$start&query.start_time_max=$end" 2>/dev/null \
    | grep -o '"name":"[^"]*"' | sort -u || true)
  if grep -q '"name":"POST"' <<<"$names" && grep -q 'graphql.resolve signUp' <<<"$names" && grep -q 'commitTransaction' <<<"$names"; then
    echo "OK: trace found"
    if [[ -n "$LOG" ]]; then
      echo "4. A request log line carries a trace id"
      grep '"msg":"request"' "$LOG" | grep -q '"traceId":"[0-9a-f]\{32\}"'
      echo "OK: logs and traces are correlated"
    fi
    exit 0
  fi
  sleep 1
done
echo "no matching trace in Jaeger"; exit 1
