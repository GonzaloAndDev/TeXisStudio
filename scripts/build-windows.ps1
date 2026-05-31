# Local Windows build for TeXisStudio.
# Generates: MSI, NSIS installer and portable ZIP.
#
# Usage:
#   .\scripts\build-windows.ps1
#   .\scripts\build-windows.ps1 -SkipPortable
#
# Requirements:
#   - Rust stable  (https://rustup.rs)
#   - Node.js 20+  (https://nodejs.org)
#   - WiX Toolset  (Tauri can install it automatically if missing)

param(
    [switch]$SkipPortable,
    [switch]$CleanInstall
)

$ErrorActionPreference = "Stop"
$root    = Split-Path -Parent $PSScriptRoot
$appDir  = Join-Path $root "texis-app"
$version = "1.0.0"

Write-Host ""
Write-Host "  TeXisStudio - Build Windows v$version" -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor Cyan

Write-Host ""
Set-Location $appDir
if ($CleanInstall -or -not (Test-Path (Join-Path $appDir "node_modules"))) {
    Write-Host "  [1/3] Installing npm dependencies..." -ForegroundColor Yellow
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { exit 1 }
} else {
    Write-Host "  [1/3] npm dependencies already installed." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  [2/4] Building frontend..." -ForegroundColor Yellow
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "  [3/4] Building MSI + NSIS..." -ForegroundColor Yellow
& npm.cmd run tauri build -- --config src-tauri\tauri.prebuilt.conf.json
if ($LASTEXITCODE -ne 0) { exit 1 }

if (-not $SkipPortable) {
    Write-Host ""
    Write-Host "  [4/4] Creating portable ZIP..." -ForegroundColor Yellow

    $bundleDir   = Join-Path $root "target\release\bundle"
    $tmpDir      = Join-Path $bundleDir "_portable_tmp"
    $portableZip = Join-Path $bundleDir "TeXisStudio_${version}_x64_portable.zip"

    if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

    $exeSrc = Join-Path $root "target\release\texis-app.exe"
    if (-not (Test-Path $exeSrc)) {
        Write-Host "  WARNING: $exeSrc not found - skipping portable ZIP" -ForegroundColor Yellow
    } else {
        Copy-Item $exeSrc (Join-Path $tmpDir "TeXisStudio.exe")

        $profilesSrc = Join-Path $root "profiles"
        if (Test-Path $profilesSrc) {
            Copy-Item -Recurse $profilesSrc (Join-Path $tmpDir "profiles")
        }

        Compress-Archive -Path "$tmpDir\*" -DestinationPath $portableZip -Force
        Remove-Item -Recurse -Force $tmpDir
        Write-Host "  -> $portableZip" -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "  [4/4] Portable ZIP skipped." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Build completed:" -ForegroundColor Green
$bundleDir = Join-Path $root "target\release\bundle"
if (Test-Path $bundleDir) {
    Get-ChildItem -Recurse $bundleDir -Include "*.msi", "*.exe", "*.zip" |
        Where-Object { $_.Name -ne "texis-app.exe" } |
        ForEach-Object { Write-Host "     $($_.FullName)" }
} else {
    Write-Host "     No bundle directory found: $bundleDir" -ForegroundColor Yellow
}
Write-Host ""
