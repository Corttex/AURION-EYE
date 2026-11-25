FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared-protocol ./packages/shared-protocol
COPY apps/web-main ./apps/web-main

RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @aurion/shared-protocol build && pnpm --filter web-main build

EXPOSE 3011
ENV PORT=3011
CMD ["pnpm", "--filter", "web-main", "start"]
