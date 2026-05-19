# Scan Go emitters and logs UI JS for structured-log msg slugs; diff against operatorcopy registry.
# Usage: scripts/operatorcopy-inventory.ps1 [-WriteReport]
param(
    [switch]$WriteReport
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$args = @()
if ($WriteReport) { $args += '-write-report' }
Push-Location $Root
try {
    go run ./internal/operatorcopy/cmd/inventory @args
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
