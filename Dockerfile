# === Stage 1: Build @aurion/shared-protocol & Rede MAIN (Next.js standalone) ===
FROM node:22-bookworm-slim AS web-builder
WORKDIR /app
RUN corepack enable

ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared-protocol ./packages/shared-protocol
COPY apps/web-main ./apps/web-main

RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @aurion/shared-protocol build && pnpm --filter web-main build
RUN mkdir -p /app/apps/web-main/.next/standalone/apps/web-main/.next && \
    cp -r /app/apps/web-main/.next/static /app/apps/web-main/.next/standalone/apps/web-main/.next/static

# === Stage 2: Runtime Unificado (Nginx :3011 + FastAPI :8000 + Next.js :3000) ===
FROM python:3.12-slim-bookworm AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    ffmpeg \
    pandoc \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=web-builder /usr/local/bin/node /usr/local/bin/node
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Backend Python (VPS Harness)
COPY apps/vps-harness/pyproject.toml /app/apps/vps-harness/pyproject.toml
RUN cd /app/apps/vps-harness && uv sync --no-dev
COPY apps/vps-harness/app /app/apps/vps-harness/app

# Frontend Next.js standalone
COPY --from=web-builder /app/apps/web-main/.next/standalone /app/web

# Nginx + Script de inicialização
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf
COPY deploy/nginx-allinone.conf /etc/nginx/conf.d/aurion.conf
COPY deploy/start-allinone.sh /app/start-allinone.sh
RUN sed -i 's/\r$//' /app/start-allinone.sh && chmod +x /app/start-allinone.sh

ENV DATABASE_URL=sqlite+aiosqlite:////data/aurion_vps.db
ENV MASTER_KEY_FILE=/data/.aurion_master.key
ENV AURION_TOKEN=aurion-dev-secret-token-2026
ENV CLAUDE_DAILY_CAP=15
ENV PORT=3011

VOLUME ["/data"]
EXPOSE 3011

CMD ["/app/start-allinone.sh"]
