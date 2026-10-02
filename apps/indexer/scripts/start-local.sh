#!/bin/sh
# Local stand-in for Railway (see compose.yaml): there is no RAILWAY_DEPLOYMENT_ID,
# so derive one from everything that feeds Ponder's build ID. A restart then
# resumes from its checkpoint, while a code or start-block change gets a fresh
# schema and takes over the views once ready, like a new Railway deployment.
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
