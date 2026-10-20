# Build from the repository root: docker build -f apps/indexer/Dockerfile .
# One image for two services: the indexer (default command) and the label
# discovery worker (`node dist/inspection/discovery-worker.js`).
FROM node:22-slim AS base
ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/indexer/package.json apps/indexer/
COPY apps/shared/package.json apps/shared/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter "@stableflow/indexer..."
COPY tsconfig.base.json ./
COPY apps/indexer apps/indexer
COPY apps/shared apps/shared
RUN pnpm --filter "@stableflow/indexer..." build

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter "@stableflow/indexer..."

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo ./
COPY tsconfig.base.json ./
COPY --from=build /repo/apps/shared/dist apps/shared/dist
# `ponder start` builds the indexing code from source; the worker runs dist/.
COPY --from=build --chown=node:node /repo/apps/indexer/dist apps/indexer/dist
COPY --chown=node:node apps/indexer/src apps/indexer/src
COPY --chown=node:node apps/indexer/scripts apps/indexer/scripts
COPY --chown=node:node apps/indexer/ponder.config.ts apps/indexer/ponder.schema.ts apps/indexer/ponder-env.d.ts apps/indexer/tsconfig.json apps/indexer/
# Ponder rewrites ponder-env.d.ts on start.
RUN chown node:node apps/indexer
WORKDIR /repo/apps/indexer
USER node
CMD ["sh", "scripts/start-production.sh"]
