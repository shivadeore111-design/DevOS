# scripts/sync-soul.ps1
# Syncs SOUL.md (canonical) to the 2 other tracked copies.
# The 3 real copies are:
#   SOUL.md                     (root — canonical, edit this one)
#   workspace/SOUL.md           (runtime working copy)
#   workspace-templates/SOUL.md (new-session template)
#
# packages/aiden-os/ ships only bin/ + README.md via npm — no SOUL.md copy.
# Run this script after every edit to SOUL.md.

$ErrorActionPreference = 'Stop'

$source = 'SOUL.md'
$targets = @(
    'workspace/SOUL.md',
    'workspace-templates/SOUL.md'
)

if (-not (Test-Path $source)) {
    Write-Error "Source SOUL.md not found at $source"
    exit 1
}

foreach ($target in $targets) {
    $dir = Split-Path $target -Parent
    if (-not (Test-Path $dir)) {
        Write-Error "Target directory $dir does not exist -- check your working directory"
        exit 1
    }
    Copy-Item $source $target -Force
    Write-Host "Synced -> $target"
}

Write-Host ''
Write-Host 'SOUL.md synced (3 copies total). Verify with:'
Write-Host '  Get-FileHash SOUL.md, workspace/SOUL.md, workspace-templates/SOUL.md'
