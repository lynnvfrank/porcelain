# Verify embed UI gallery HTML link hrefs and script/img src paths.
# Fails when:
#   - href/src uses obsolete repo-relative chimera/.../embedui paths
#   - href/src contains internal/server/embedui without adminui/embed/embedui
#   - a /ui/assets/ or relative local path does not exist under embedui/
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$GalleryHtml = Join-Path $Root 'chimera\chimera-gateway\internal\server\adminui\embed\embedui\settings\gallery.html'
$EmbedUi = Join-Path $Root 'chimera\chimera-gateway\internal\server\adminui\embed\embedui'
$fail = $false

function Test-SkippableUrl([string]$Path) {
    return $Path -match '^(https?:|//|mailto:|javascript:|data:)'
}

function Test-ForbiddenGalleryRef([string]$Value, [string]$File) {
    if ($Value -match 'reload\.svg|sample\.html|/ui/assets/settings/gallery') {
        Write-Host "check-component-gallery-paths: forbidden gallery path: $File" -ForegroundColor Red
        Write-Host "  -> $Value" -ForegroundColor Red
        $script:fail = $true
    }
    if ($Value -match '^/ui/gallery' -and $Value -notmatch '^/ui/settings/gallery') {
        Write-Host "check-component-gallery-paths: forbidden gallery path: $File" -ForegroundColor Red
        Write-Host "  -> $Value" -ForegroundColor Red
        $script:fail = $true
    }
}

function Test-EmbedUiPath([string]$Value, [string]$File) {
    if ($Value -match 'internal/server/embedui' -and $Value -notmatch 'adminui/embed/embedui') {
        Write-Host "check-component-gallery-paths: obsolete embed path (use /ui/assets/): $File" -ForegroundColor Red
        Write-Host "  -> $Value" -ForegroundColor Red
        $script:fail = $true
    }
    if ($Value -match 'chimera/chimera-gateway.*embed/embedui' -or $Value -match '\.\./\.\./chimera/') {
        Write-Host "check-component-gallery-paths: use /ui/assets/ paths, not repo-relative embed paths: $File" -ForegroundColor Red
        Write-Host "  -> $Value" -ForegroundColor Red
        $script:fail = $true
    }
}

function Resolve-LocalPath([string]$BaseDir, [string]$Ref) {
    $path = ($Ref -split '[#?]')[0]
    if ([string]::IsNullOrWhiteSpace($path)) { return $null }
    if (Test-SkippableUrl $path) { return $null }
    if ($path -like '/ui/settings*' -or $path -like '/ui/assets/settings*') { return $null }
    if ($path.StartsWith('/ui/assets/')) {
        $rel = $path.Substring('/ui/assets/'.Length)
        return (Join-Path $EmbedUi $rel)
    }
    if ($path.StartsWith('/')) { return $path }
    return (Join-Path $BaseDir $path)
}

if (-not (Test-Path -LiteralPath $GalleryHtml)) {
    Write-Host "check-component-gallery-paths: missing $GalleryHtml" -ForegroundColor Red
    exit 1
}

$html = $GalleryHtml
$baseDir = Split-Path -Parent $GalleryHtml
$content = Get-Content -LiteralPath $html -Raw
foreach ($m in [regex]::Matches($content, '(?:href|src)=["'']([^"'']+)["'']')) {
    $attr = $m.Groups[1].Value
    Test-ForbiddenGalleryRef $attr $html
    Test-EmbedUiPath $attr $html
    $resolved = Resolve-LocalPath $baseDir $attr
    if ($null -ne $resolved -and -not (Test-Path -LiteralPath $resolved)) {
        Write-Host "check-component-gallery-paths: missing file: $html" -ForegroundColor Red
        Write-Host "  -> $attr" -ForegroundColor Red
        $fail = $true
    }
}

if ($fail) { exit 1 }
Write-Host "check-component-gallery-paths: OK ($GalleryHtml)"
