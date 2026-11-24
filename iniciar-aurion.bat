@echo off
title AURION Ecosystem Launcher
cd /d "%~dp0"

echo [1/3] Iniciando VPS Harness (porta 8000)...
start "AURION VPS Harness (8000)" cmd /k "cd /d "%~dp0apps\vps-harness" && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000"

echo [2/3] Iniciando Rede MAIN (porta 3011)...
start "AURION Rede MAIN (3011)" cmd /k "cd /d "%~dp0" && pnpm --filter web-main dev"

echo [3/3] Iniciando Aurion Eye (porta 1420)...
start "AURION Eye (1420)" cmd /k "cd /d "%~dp0" && pnpm --filter desktop-eye dev"

timeout /t 4 /nobreak >nul
start http://localhost:3011
start msedge --app=http://localhost:1420 2>nul || start http://localhost:1420
echo Tudo iniciado!
