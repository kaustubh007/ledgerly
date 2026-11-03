#!/usr/bin/env bash
# Runs *before* the API starts (first step of its webServer command): empties the E2E database,
# so every run starts clean, and so the API's index build at boot is not undone by a later drop
# (unique indexes back idempotency and invoice numbering). Also creates the log directory, and
# the OPS staff member the admin console test signs in as (STAFF_EMAIL / STAFF_PASSWORD from
# playwright.config.ts; there is no staff sign-up).
set -euo pipefail
root=$(cd "$(dirname "$0")/../../.." && pwd)
mkdir -p "$root/.e2e-logs"
docker compose --project-directory "$root" exec -T mongo mongosh --quiet ledgerly_e2e --eval 'db.dropDatabase()' >/dev/null
(cd "$root/apps/api" && STAFF_PASSWORD="$STAFF_PASSWORD" node --conditions=@ledgerly/source \
  src/scripts/create-staff.ts --email "$STAFF_EMAIL" --name "E2E Ops" --role OPS >/dev/null)
