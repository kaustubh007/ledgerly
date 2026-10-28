#!/usr/bin/env bash
# Proves the local stack does what later phases rely on. Run after `make up`; CI runs it too.
set -euo pipefail

echo "1. MongoDB is a replica set with a primary"
state=$(docker compose exec -T mongo mongosh --quiet --eval 'rs.status().members[0].stateStr')
[[ "$state" == "PRIMARY" ]] || { echo "expected PRIMARY, got $state"; exit 1; }

echo "2. A multi-document transaction commits"
committed=$(docker compose exec -T mongo mongosh --quiet ledgerly_smoke --eval '
  db.dropDatabase();
  db.createCollection("a"); db.createCollection("b");
  const s = db.getMongo().startSession();
  s.startTransaction();
  s.getDatabase("ledgerly_smoke").a.insertOne({ n: 1 });
  s.getDatabase("ledgerly_smoke").b.insertOne({ n: 1 });
  s.commitTransaction();
  const n = db.a.countDocuments() + db.b.countDocuments();
  db.dropDatabase();
  n')
[[ "$committed" == "2" ]] || { echo "expected 2 documents, got $committed"; exit 1; }

echo "3. The collector is healthy"
curl -fsS http://localhost:13133/ >/dev/null

echo "4. A span sent to the collector arrives in Jaeger"
trace_id=$(openssl rand -hex 16)
span_id=$(openssl rand -hex 8)
now=$(date +%s%N)
curl -fsS -X POST http://localhost:4318/v1/traces -H 'Content-Type: application/json' -d "{
  \"resourceSpans\": [{
    \"resource\": { \"attributes\": [{ \"key\": \"service.name\", \"value\": { \"stringValue\": \"smoke\" } }] },
    \"scopeSpans\": [{ \"spans\": [{
      \"traceId\": \"$trace_id\", \"spanId\": \"$span_id\", \"name\": \"smoke-test\", \"kind\": 1,
      \"startTimeUnixNano\": \"$now\", \"endTimeUnixNano\": \"$((now + 1000000))\"
    }] }]
  }]
}" >/dev/null
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:16686/api/traces/$trace_id" 2>/dev/null | grep -q smoke-test; then
    echo "OK: local stack is healthy"
    exit 0
  fi
  sleep 1
done
echo "span $trace_id did not reach Jaeger"; exit 1
