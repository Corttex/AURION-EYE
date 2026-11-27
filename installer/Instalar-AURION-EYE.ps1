$ErrorActionPreference = "Stop"

$InstallDir = Join-Path $env:LOCALAPPDATA "AurionEye"
$AppDistDir = Join-Path $InstallDir "dist"
$RepoRoot   = Split-Path -Parent $PSScriptRoot
$SourceDist = Join-Path $RepoRoot "apps\desktop-eye\dist"
$SourceIcon = Join-Path $RepoRoot "apps\desktop-eye\src-tauri\icons\icon.ico"

Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "   AURION EYE - Instalador Sem Permissao Admin   " -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "[1/4] Instalando em: $InstallDir"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
if (Test-Path $AppDistDir) { Remove-Item -Recurse -Force $AppDistDir }
Copy-Item -Recurse -Force $SourceDist $AppDistDir
if (Test-Path $SourceIcon) {
    Copy-Item -Force $SourceIcon (Join-Path $InstallDir "icon.ico")
}

Write-Host "[2/4] Criando servidor local leve (Node/Python) + launcher..."
$ServerJs = @'
const http = require("http");
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "dist");
const port = 1425;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "/").split("?")[0];
  let filePath = path.join(distDir, urlPath === "/" ? "index.html" : urlPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, "index.html");
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

server.on("error", () => process.exit(0));
server.listen(port, "127.0.0.1");
'@
Set-Content -Path (Join-Path $InstallDir "server.cjs") -Value $ServerJs -Encoding UTF8

# Clean up old VBS if present
$OldVbs = Join-Path $InstallDir "AurionEye.vbs"
if (Test-Path $OldVbs) { Remove-Item -Force $OldVbs }

$EdgePath = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $EdgePath) { $EdgePath = "msedge.exe" }

$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
$PythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source

if ($NodeExe) {
    $StartServerLine = "start `"`" /B `"$NodeExe`" `"%~dp0server.cjs`""
} elseif ($PythonExe) {
    $StartServerLine = "start `"`" /B `"$PythonExe`" -m http.server 1425 --bind 127.0.0.1 --directory `"%~dp0dist`""
} else {
    $StartServerLine = "echo Nenhum runtime Node/Python encontrado"
}

$LaunchCmd = @"
@echo off
cd /d "%~dp0"
$StartServerLine
timeout /t 1 /nobreak >nul
start "" "$EdgePath" --app=http://127.0.0.1:1425 --window-size=980,620 --user-data-dir="%~dp0profile"
exit
"@

$LaunchCmdPath = Join-Path $InstallDir "launch.cmd"
Set-Content -Path $LaunchCmdPath -Value $LaunchCmd -Encoding ASCII

Write-Host "[3/4] Atualizando atalhos na Area de Trabalho e Menu Iniciar..."
$WshShell = New-Object -ComObject WScript.Shell
$DesktopLnk = Join-Path ([Environment]::GetFolderPath("Desktop")) "AURION Eye.lnk"
$StartMenuLnk = Join-Path ([Environment]::GetFolderPath("Programs")) "AURION Eye.lnk"

foreach ($LnkPath in @($DesktopLnk, $StartMenuLnk)) {
    $Shortcut = $WshShell.CreateShortcut($LnkPath)
    $Shortcut.TargetPath = $LaunchCmdPath
    $Shortcut.Arguments = ""
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.WindowStyle = 7
    $Shortcut.Description = "AURION Eye - Singularity HUD"
    $IconFile = Join-Path $InstallDir "icon.ico"
    if (Test-Path $IconFile) { $Shortcut.IconLocation = $IconFile }
    $Shortcut.Save()
}

Write-Host "[4/4] Instalacao concluida com sucesso (ZERO VBS / ZERO Admin)!" -ForegroundColor Green
Write-Host "Atalho atualizado: $DesktopLnk" -ForegroundColor Cyan
