#!/bin/sh
# Local stand-in for Railway (see compose.yaml): there is no RAILWAY_DEPLOYMENT_ID,
# so derive one from everything that feeds Ponder's build ID. Like on Railway, every
# start indexes into a fresh schema and takes over the views once ready.
set -eu

RAILWAY_DEPLOYMENT_ID=$(
  {
    echo "$PONDER_DISCOVERY_START_BLOCK_8453"
    cat package.json ponder.config.ts ponder.schema.ts
    find src -type f | sort | xargs cat
  } | sha256sum | cut -c1-32
)
export RAILWAY_DEPLOYMENT_ID

exec sh scripts/start-production.sh
