# Verify docs/component-gallery/*.html link hrefs and script/img src paths.
# Fails when:
#   - href/src contains internal/server/embedui without adminui/embed/embedui
#   - a relative local asset path does not exist on disk
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Gallery = Join-Path $Root 'docs\component-gallery'
$fail = $false

function Test-SkippableUrl([string]$Path) {
    return $Path -match '^(https?:|//|mailto:|javascript:|data:)'
}

function Test-EmbedUiPath([string]$Value, [string]$File) {
    if ($Value -match 'internal/server/embedui' -and $Value -notmatch 'adminui/embed/embedui') {
        Write-Host "check-component-gallery-paths: obsolete embed path (use adminui/embed/embedui): $File" -ForegroundColor Red
        Write-Host "  -> $Value" -ForegroundColor Red
        $script:fail = $true
    }
}

function Resolve-LocalPath([string]$BaseDir, [string]$Ref) {
    $path = ($Ref -split '[#?]')[0]
    if ([string]::IsNullOrWhiteSpace($path)) { return $null }
    if (Test-SkippableUrl $path) { return $null }
    if ($path.StartsWith('/')) { return $path }
    return (Join-Path $BaseDir $path)
}

Get-ChildItem -Path $Gallery -Filter '*.html' | ForEach-Object {
    $html = $_.FullName
    $baseDir = $_.DirectoryName
    $content = Get-Content -LiteralPath $html -Raw
    foreach ($m in [regex]::Matches($content, '(?:href|src)=["'']([^"'']+)["'']')) {
        $attr = $m.Groups[1].Value
        Test-EmbedUiPath $attr $html
        $resolved = Resolve-LocalPath $baseDir $attr
        if ($null -ne $resolved -and -not (Test-Path -LiteralPath $resolved)) {
            Write-Host "check-component-gallery-paths: missing file: $html" -ForegroundColor Red
            Write-Host "  -> $attr" -ForegroundColor Red
            $fail = $true
        }
    }
}

if ($fail) { exit 1 }
Write-Host "check-component-gallery-paths: OK ($Gallery)"
