#!/bin/sh
# Zero-downtime indexer start (Ponder views pattern).
#
# Every deployment indexes into its own schema, derived from the Railway deployment ID,
# starting a few minutes before the archive's newest data: history lives in the archive,
# so a new deployment only backfills minutes. A restart of the same deployment reuses its
# schema and start block and resumes from its last checkpoint. Once a new deployment
# reaches realtime, Ponder repoints the views in DATABASE_VIEWS_SCHEMA.
set -eu

: "${RAILWAY_DEPLOYMENT_ID:?RAILWAY_DEPLOYMENT_ID is required}"
: "${DATABASE_VIEWS_SCHEMA:?DATABASE_VIEWS_SCHEMA is required}"

# Deployment IDs are UUIDs; without dashes the name stays unquoted-safe (40 chars).
DATABASE_SCHEMA="indexer_$(printf '%s' "$RAILWAY_DEPLOYMENT_ID" | tr -d '-' | tr 'A-Z' 'a-z')"
export DATABASE_SCHEMA
# PONDER_DISCOVERY_START_BLOCK_8453 seeds only the very first deployment.
PONDER_DISCOVERY_START_BLOCK_8453=$(node dist/scripts/resolve-start-block.js)
export PONDER_DISCOVERY_START_BLOCK_8453
export PONDER_TELEMETRY_DISABLED=1

exec ./node_modules/.bin/ponder start
