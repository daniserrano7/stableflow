# Build from the repository root: docker build -f apps/mcp/Dockerfile .
FROM node:22-slim AS base
ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mcp/package.json apps/mcp/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter "@stableflow/mcp..."
COPY tsconfig.base.json ./
COPY apps/mcp apps/mcp
RUN pnpm --filter "@stableflow/mcp..." build

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter "@stableflow/mcp..."

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo ./
COPY --from=build /repo/apps/mcp/dist apps/mcp/dist
WORKDIR /repo/apps/mcp
USER node
CMD ["node", "dist/main.js"]
