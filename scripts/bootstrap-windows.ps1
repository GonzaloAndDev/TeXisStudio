# Bootstrap para Windows.
# Prepara dependencias base y opcionalmente corre la app o genera instalador.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\bootstrap-windows.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\bootstrap-windows.ps1 -Run
#   powershell -ExecutionPolicy Bypass -File scripts\bootstrap-windows.ps1 -Installer

param(
    [switch]$Run,
    [switch]$Installer,
    [switch]$FrontendBuild,
    [switch]$CheckAll
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$appDir = Join-Path $root "texis-app"

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-NodeMajor {
    if (-not (Test-Command "node")) { return 0 }
    $version = (& node --version).Trim().TrimStart("v")
    return [int]($version.Split(".")[0])
}

function Install-WithWinget {
    param(
        [string]$Id,
        [string]$Name
    )

    if (-not (Test-Command "winget")) {
        throw "Falta $Name y no encontre winget. Instala $Name manualmente y vuelve a ejecutar."
    }

    Write-Host "  Instalando $Name con winget..." -ForegroundColor Yellow
    & winget install --id $Id --exact --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "No pude instalar $Name con winget." }
}

Write-Host ""
Write-Host "  TeXisStudio - bootstrap Windows" -ForegroundColor Cyan
Write-Host "  ===============================" -ForegroundColor Cyan
Write-Host "  Root : $root"
Write-Host ""

if ((Get-NodeMajor) -lt 20 -or -not (Test-Command "npm.cmd")) {
    Install-WithWinget -Id "OpenJS.NodeJS.LTS" -Name "Node.js LTS"
    Write-Host "  Cierra y abre la terminal si node/npm aun no aparecen en PATH." -ForegroundColor Yellow
}

if (-not (Test-Command "cargo") -or -not (Test-Command "rustc")) {
    Install-WithWinget -Id "Rustlang.Rustup" -Name "Rustup"
    Write-Host "  Cierra y abre la terminal si cargo/rustc aun no aparecen en PATH." -ForegroundColor Yellow
}

if ((Get-NodeMajor) -lt 20) {
    throw "Node.js 20+ no esta disponible en esta terminal. Cierra y abre VS Code/PowerShell y vuelve a ejecutar."
}

if (-not (Test-Command "cargo") -or -not (Test-Command "rustc")) {
    throw "Rust no esta disponible en esta terminal. Cierra y abre VS Code/PowerShell y vuelve a ejecutar."
}

Write-Host "  OK Node.js: $((& node --version).Trim())" -ForegroundColor Green
Write-Host "  OK npm    : $((& npm.cmd --version).Trim())" -ForegroundColor Green
Write-Host "  OK Rust   : $((& rustc --version).Trim())" -ForegroundColor Green

Write-Host ""
Set-Location $appDir
$nodeModules = Join-Path $appDir "node_modules"
$nodeLock = Join-Path $nodeModules ".package-lock.json"
$packageLock = Join-Path $appDir "package-lock.json"
$npmReady = (Test-Path $nodeModules) -and (Test-Path $nodeLock) -and ((Get-Item $packageLock).LastWriteTime -le (Get-Item $nodeLock).LastWriteTime)

if ($npmReady) {
    Write-Host "  OK dependencias npm" -ForegroundColor Green
} else {
    Write-Host "  Instalando dependencias npm..." -ForegroundColor Yellow
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

Set-Location $root
if ($Run) {
    & node scripts\texis.mjs run
    exit $LASTEXITCODE
}

if ($Installer) {
    & node scripts\texis.mjs installer
    exit $LASTEXITCODE
}

if ($FrontendBuild) {
    & node scripts\texis.mjs frontend-build
    exit $LASTEXITCODE
}

if ($CheckAll) {
    & node scripts\texis.mjs check-all
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "  Equipo listo." -ForegroundColor Green
Write-Host "  Siguiente:"
Write-Host "    node scripts\texis.mjs run"
Write-Host "    node scripts\texis.mjs installer"
