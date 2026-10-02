# Build from the repository root: docker build -f apps/api/Dockerfile .
FROM node:22-slim AS base
ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/indexer/package.json apps/indexer/
COPY apps/shared/package.json apps/shared/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter "@stableflow/api..."
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY apps/indexer apps/indexer
COPY apps/shared apps/shared
RUN pnpm --filter "@stableflow/api..." build

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter "@stableflow/api..."

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo ./
# The API imports the indexer's compiled Drizzle schema and address labels.
COPY --from=build /repo/apps/shared/dist apps/shared/dist
COPY --from=build /repo/apps/indexer/dist apps/indexer/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
WORKDIR /repo/apps/api
USER node
CMD ["node", "dist/main.js"]
