$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
& powershell -ExecutionPolicy Bypass -File (Join-Path $root "scripts\bootstrap-windows.ps1") -FrontendBuild
exit $LASTEXITCODE
