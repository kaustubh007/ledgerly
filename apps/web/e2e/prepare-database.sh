#!/usr/bin/env bash
# Runs *before* the API starts (first step of its webServer command): empties the E2E database,
# so every run starts clean, and so the API's index build at boot is not undone by a later drop
# (unique indexes back idempotency and invoice numbering). Also creates the log directory.
set -euo pipefail
root=$(cd "$(dirname "$0")/../../.." && pwd)
mkdir -p "$root/.e2e-logs"
docker compose --project-directory "$root" exec -T mongo mongosh --quiet ledgerly_e2e --eval 'db.dropDatabase()' >/dev/null
