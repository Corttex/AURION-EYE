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

Write-Host "[2/4] Criando launcher standalone..."
$LauncherPs1 = @'
$ErrorActionPreference = "SilentlyContinue"
$InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DistDir = Join-Path $InstallDir "dist"
$Port = 1425

# Check if port 1425 is already serving
$Listening = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
    if ($iar.AsyncWaitHandle.WaitOne(200, $false)) {
        $tcp.EndConnect($iar)
        $Listening = $true
    }
    $tcp.Close()
} catch {}

if (-not $Listening) {
    $PyCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($PyCmd) {
        Start-Process -FilePath $PyCmd.Source -ArgumentList "-m http.server $Port --bind 127.0.0.1 --directory `"$DistDir`"" -WindowStyle Hidden
    } else {
        $NpxCmd = Get-Command npx -ErrorAction SilentlyContinue
        if ($NpxCmd) {
            Start-Process -FilePath $NpxCmd.Source -ArgumentList "--yes serve `"$DistDir`" -l $Port" -WindowStyle Hidden
        }
    }
    Start-Sleep -Milliseconds 700
}

$Url = "http://127.0.0.1:$Port"
$Edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$Edge64 = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$UserData = Join-Path $InstallDir "profile"

if (Test-Path $Edge) {
    Start-Process -FilePath $Edge -ArgumentList "--app=$Url --window-size=980,620 --user-data-dir=`"$UserData`""
} elseif (Test-Path $Edge64) {
    Start-Process -FilePath $Edge64 -ArgumentList "--app=$Url --window-size=980,620 --user-data-dir=`"$UserData`""
} elseif (Test-Path $Chrome) {
    Start-Process -FilePath $Chrome -ArgumentList "--app=$Url --window-size=980,620 --user-data-dir=`"$UserData`""
} else {
    Start-Process $Url
}
'@

Set-Content -Path (Join-Path $InstallDir "launch-aurion.ps1") -Value $LauncherPs1 -Encoding UTF8

$LauncherVbs = @'
Set shell = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\launch-aurion.ps1""", 0, False
'@
$VbsPath = Join-Path $InstallDir "AurionEye.vbs"
Set-Content -Path $VbsPath -Value $LauncherVbs -Encoding ASCII

Write-Host "[3/4] Criando atalho na Area de Trabalho e Menu Iniciar..."
$WshShell = New-Object -ComObject WScript.Shell
$DesktopLnk = Join-Path ([Environment]::GetFolderPath("Desktop")) "AURION Eye.lnk"
$StartMenuLnk = Join-Path ([Environment]::GetFolderPath("Programs")) "AURION Eye.lnk"

foreach ($LnkPath in @($DesktopLnk, $StartMenuLnk)) {
    $Shortcut = $WshShell.CreateShortcut($LnkPath)
    $Shortcut.TargetPath = "wscript.exe"
    $Shortcut.Arguments = "`"$VbsPath`""
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "AURION Eye - Singularity HUD"
    $IconFile = Join-Path $InstallDir "icon.ico"
    if (Test-Path $IconFile) { $Shortcut.IconLocation = $IconFile }
    $Shortcut.Save()
}

Write-Host "[4/4] Instalacao concluida com sucesso (ZERO permissao de admin)!" -ForegroundColor Green
Write-Host "Atalho criado na Area de Trabalho: $DesktopLnk" -ForegroundColor Cyan
