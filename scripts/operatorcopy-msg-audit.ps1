# Fail when chimera-gateway logs conversation.* slugs as raw string literals.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$violations = $false
Get-ChildItem -Path "chimera/chimera-gateway/internal" -Filter "*.go" -Recurse |
  Where-Object { $_.Name -notmatch '_test\.go$' } |
  ForEach-Object {
    $matches = Select-String -Path $_.FullName -Pattern '"msg"\s*,\s*"conversation\.' -AllMatches
    if ($matches) {
      $violations = $true
      Write-Host "operatorcopy-msg-audit: raw conversation msg literal in $($_.FullName)"
      $matches | Select-Object -First 20 | ForEach-Object { Write-Host $_.Line }
    }
  }

if ($violations) {
  Write-Host "operatorcopy-msg-audit: use naming.Msg* from internal/naming/log_messages.go"
  exit 1
}

Write-Host "operatorcopy-msg-audit: OK (no raw conversation.* msg literals)"
