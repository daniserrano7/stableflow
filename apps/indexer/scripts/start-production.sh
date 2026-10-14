#!/bin/sh
# Zero-downtime indexer start (Ponder views pattern).
#
# Every start, including a crash restart of the same deployment, indexes into a fresh
# schema that begins at most 10 minutes behind the chain head (scripts/start-block.ts).
# With the RPC cache disabled, resuming an old schema would re-fetch everything since
# that schema's start block, so a fresh one is always cheaper; data the indexer missed
# while down is skipped. Once the new schema reaches realtime, Ponder repoints the views
# in DATABASE_VIEWS_SCHEMA and the older schemas are dropped.
set -eu

: "${RAILWAY_DEPLOYMENT_ID:?RAILWAY_DEPLOYMENT_ID is required}"
: "${DATABASE_VIEWS_SCHEMA:?DATABASE_VIEWS_SCHEMA is required}"

# indexer_<16 hex of the deployment ID>_<start time>: 35 chars, unquoted-safe.
DEPLOYMENT=$(printf '%s' "$RAILWAY_DEPLOYMENT_ID" | tr -d '-' | tr 'A-Z' 'a-z' | cut -c1-16)
DATABASE_SCHEMA="indexer_${DEPLOYMENT}_$(date +%s)"
export DATABASE_SCHEMA
PONDER_DISCOVERY_START_BLOCK_8453=$(node dist/scripts/resolve-start-block.js)
export PONDER_DISCOVERY_START_BLOCK_8453
export PONDER_TELEMETRY_DISABLED=1

# Once this schema serves the views, drop the schemas of stopped deployments. Ponder
# skips any deployment that still holds its lock (heartbeat), so the first pass waits
# for the previous deployment to finish draining.
(
  until node -e "fetch('http://localhost:${PORT:-42069}/ready').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"; do
    sleep 30
  done
  while :; do
    sleep 300
    ./node_modules/.bin/ponder db prune || true
    sleep 3300
  done
) &

exec ./node_modules/.bin/ponder start
