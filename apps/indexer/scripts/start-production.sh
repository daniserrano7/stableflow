#!/bin/sh
# Zero-downtime indexer start (Ponder views pattern).
#
# Every deployment indexes into its own schema, derived from the Railway
# deployment ID. A restart of the same deployment reuses that schema and resumes
# from its last checkpoint; a new deployment backfills into a fresh one while the
# previous deployment keeps serving. Once the new one reaches realtime, Ponder
# repoints the views in DATABASE_VIEWS_SCHEMA, which is what the API reads.
set -eu

: "${RAILWAY_DEPLOYMENT_ID:?RAILWAY_DEPLOYMENT_ID is required}"
: "${DATABASE_VIEWS_SCHEMA:?DATABASE_VIEWS_SCHEMA is required}"

# Deployment IDs are UUIDs; without dashes the name stays unquoted-safe (40 chars).
DATABASE_SCHEMA="indexer_$(printf '%s' "$RAILWAY_DEPLOYMENT_ID" | tr -d '-' | tr 'A-Z' 'a-z')"
export DATABASE_SCHEMA
export PONDER_TELEMETRY_DISABLED=1

exec ./node_modules/.bin/ponder start
