# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:22-slim AS base
ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/shared/package.json apps/shared/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter "@stableflow/web..."
COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY apps/shared apps/shared
RUN pnpm --filter "@stableflow/web..." build

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter "@stableflow/web..."

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo ./
COPY --from=build /repo/apps/shared/dist apps/shared/dist
COPY --from=build /repo/apps/web/build apps/web/build
WORKDIR /repo/apps/web
USER node
CMD ["node_modules/.bin/react-router-serve", "build/server/index.js"]
