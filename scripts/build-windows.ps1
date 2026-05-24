# Build local de TeXisStudio para Windows
# Genera: MSI, NSIS installer y portable ZIP
#
# Uso:
#   .\scripts\build-windows.ps1
#
# Requisitos:
#   - Rust stable  (https://rustup.rs)
#   - Node.js 18+  (https://nodejs.org)
#   - WiX Toolset  (instalado automáticamente por Tauri si falta)

param(
    [switch]$SkipPortable   # Omitir la creación del ZIP portable
)

$ErrorActionPreference = "Stop"
$root    = Split-Path -Parent $PSScriptRoot
$appDir  = Join-Path $root "texis-app"
$version = "1.0.0"

Write-Host ""
Write-Host "  TeXisStudio — Build Windows v$version" -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor Cyan

# ── [1/3] npm ci ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  [1/3] Instalando dependencias npm..." -ForegroundColor Yellow
Set-Location $appDir
npm ci
if ($LASTEXITCODE -ne 0) { exit 1 }

# ── [2/3] tauri build ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  [2/3] Compilando (MSI + NSIS)..." -ForegroundColor Yellow
npm run tauri build
if ($LASTEXITCODE -ne 0) { exit 1 }

# ── [3/3] Portable ZIP ───────────────────────────────────────────────────────
if (-not $SkipPortable) {
    Write-Host ""
    Write-Host "  [3/3] Creando portable ZIP..." -ForegroundColor Yellow

    $bundleDir   = Join-Path $root "target\release\bundle"
    $tmpDir      = Join-Path $bundleDir "_portable_tmp"
    $portableZip = Join-Path $bundleDir "TeXisStudio_${version}_x64_portable.zip"

    if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

    # El exe se renombra al productName para el usuario final
    $exeSrc = Join-Path $root "target\release\texis-app.exe"
    if (-not (Test-Path $exeSrc)) {
        Write-Host "  ⚠  No se encontró $exeSrc — omitiendo portable" -ForegroundColor Yellow
    } else {
        Copy-Item $exeSrc (Join-Path $tmpDir "TeXisStudio.exe")

        # Perfiles — se ubican junto al exe para que resource_dir() los encuentre
        $profilesSrc = Join-Path $root "profiles"
        if (Test-Path $profilesSrc) {
            Copy-Item -Recurse $profilesSrc (Join-Path $tmpDir "profiles")
        }

        Compress-Archive -Path "$tmpDir\*" -DestinationPath $portableZip -Force
        Remove-Item -Recurse -Force $tmpDir
        Write-Host "  → $portableZip" -ForegroundColor Green
    }
}

# ── Resumen ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ✅ Build completado:" -ForegroundColor Green
$bundleDir = Join-Path $root "target\release\bundle"
Get-ChildItem -Recurse $bundleDir -Include "*.msi", "*.exe", "*.zip" |
    Where-Object { $_.Name -ne "texis-app.exe" } |
    ForEach-Object { Write-Host "     $($_.FullName)" }
Write-Host ""
