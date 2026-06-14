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
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

function Format-Duration {
    param([TimeSpan]$Duration)

    if ($Duration.TotalHours -ge 1) {
        return "{0} h {1} min {2} s" -f [int]$Duration.TotalHours, $Duration.Minutes, $Duration.Seconds
    }
    if ($Duration.TotalMinutes -ge 1) {
        return "{0} min {1} s" -f [int]$Duration.TotalMinutes, $Duration.Seconds
    }
    return "{0} s" -f [int]$Duration.TotalSeconds
}

function Invoke-TargetCleanup {
    if ($env:TEXIS_KEEP_TARGET -eq "1") {
        Write-Host ""
        Write-Host "  Target cleanup skipped (TEXIS_KEEP_TARGET=1)." -ForegroundColor Yellow
        return
    }

    $targetDir = Join-Path $root "target"
    $bundleDir = Join-Path $targetDir "release\bundle"
    $preserveDir = Join-Path ([System.IO.Path]::GetTempPath()) ("texis-artifacts-" + [System.Guid]::NewGuid().ToString("N"))
    $preserveBundle = Join-Path $preserveDir "bundle"

    New-Item -ItemType Directory -Force -Path $preserveBundle | Out-Null

    if (Test-Path $bundleDir) {
        Get-ChildItem -Recurse $bundleDir -Include "*.msi", "*.exe", "*.zip" |
            Where-Object { $_.Name -ne "texis-app.exe" } |
            Copy-Item -Destination $preserveBundle -Force
    }

    if (Test-Path $targetDir) {
        Remove-Item -Recurse -Force $targetDir
    }

    if (Test-Path $preserveBundle) {
        $artifacts = Get-ChildItem $preserveBundle -File
        if ($artifacts.Count -gt 0) {
            New-Item -ItemType Directory -Force -Path $bundleDir | Out-Null
            $artifacts | Copy-Item -Destination $bundleDir -Force
        }
    }

    if (Test-Path $preserveDir) {
        Remove-Item -Recurse -Force $preserveDir
    }
}

Write-Host ""
Write-Host "  TeXisStudio - Build Windows v$version" -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor Cyan

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name"
    }
}

Assert-Command "node"
Assert-Command "npm.cmd"
Assert-Command "cargo"
Assert-Command "rustc"

$nodeVersion = (& node --version).Trim()
$nodeMajor = [int]($nodeVersion.TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 20) {
    throw "Node.js 20+ is required. Detected: $nodeVersion"
}

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
Write-Host "  [2/3] Building MSI + NSIS..." -ForegroundColor Yellow
& npm.cmd run tauri build
if ($LASTEXITCODE -ne 0) { exit 1 }

if (-not $SkipPortable) {
    Write-Host ""
    Write-Host "  [3/3] Creating portable ZIP..." -ForegroundColor Yellow

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
    Write-Host "  [3/3] Portable ZIP skipped." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Cleaning target build cache..." -ForegroundColor Yellow
Invoke-TargetCleanup

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
$stopwatch.Stop()
$finishedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
Write-Host ""
Write-Host "  Finished : $finishedAt" -ForegroundColor Green
Write-Host "  Duration : $(Format-Duration $stopwatch.Elapsed)" -ForegroundColor Green
Write-Host ""
