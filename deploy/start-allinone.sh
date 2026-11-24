#!/usr/bin/env bash
set -euo pipefail

mkdir -p /data

echo "[AURION] Iniciando VPS Harness (127.0.0.1:8000)..."
(
  cd /app/apps/vps-harness
  exec /app/apps/vps-harness/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
) &

echo "[AURION] Iniciando Rede MAIN (127.0.0.1:3000)..."
(
  cd /app/web/apps/web-main
  HOSTNAME=127.0.0.1 PORT=3000 exec node /app/web/apps/web-main/server.js
) &

echo "[AURION] Iniciando Gateway Nginx unificado (:3011)..."
exec nginx -g "daemon off;"
