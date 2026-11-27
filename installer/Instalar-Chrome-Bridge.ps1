$ErrorActionPreference = "Stop"

$InstallDir = Join-Path $env:LOCALAPPDATA "AurionEye\chrome-bridge"
$RepoRoot   = Split-Path -Parent $PSScriptRoot
$SourceDir  = Join-Path $RepoRoot "apps\chrome-bridge"
$ZipOut     = Join-Path $PSScriptRoot "dist-exe\aurion-chrome-bridge-v1.0.0.zip"

Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "  AURION Chrome Bridge - Instalador Sem Admin    " -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host ""

Write-Host "[1/3] Copiando extensao Manifest V3 para: $InstallDir"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -Path (Join-Path $SourceDir "*") -Destination $InstallDir -Recurse -Force

# Generate distributable .zip alongside the Windows .exe installer
$ZipDir = Split-Path -Parent $ZipOut
New-Item -ItemType Directory -Force -Path $ZipDir | Out-Null
if (Test-Path $ZipOut) { Remove-Item -Force $ZipOut }
Compress-Archive -Path (Join-Path $InstallDir "*") -DestinationPath $ZipOut -Force

Write-Host "[2/3] Copiando caminho da pasta para sua Area de Transferencia (Ctrl+V)..."
Set-Clipboard -Value $InstallDir

Write-Host "[3/3] Abrindo pagina de extensoes do Google Chrome..."
$ChromeExe = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($ChromeExe) {
    Start-Process -FilePath $ChromeExe -ArgumentList "chrome://extensions/"
} else {
    Write-Host "Abra o Chrome manualmente em: chrome://extensions/" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "PASSO FINAL NO CHROME (leva 5 segundos):" -ForegroundColor Green
Write-Host "  1. Ative 'Modo do desenvolvedor' (canto superior direito)"
Write-Host "  2. Clique em 'Carregar sem compactacao'"
Write-Host "  3. Aperte Ctrl+V e Enter (o caminho ja esta copiado!)" -ForegroundColor Cyan
Write-Host "     Caminho: $InstallDir" -ForegroundColor DarkGray
