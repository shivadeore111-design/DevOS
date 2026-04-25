# run-all.ps1 - Orchestrator for Aiden v3.11 test harness
# Runs all 4 tiers, merges results, generates TEST_REPORT-<timestamp>.md

[CmdletBinding()]
param(
    [switch]$SkipTier3,   # skip LLM judge (saves Anthropic API cost)
    [switch]$Tier1Only,   # smoke check only
    [string]$ReportDir = $PSScriptRoot
)

. "$PSScriptRoot\lib\test-helpers.ps1"
. "$PSScriptRoot\lib\report-builder.ps1"

$ts      = Get-Date -Format "yyyyMMdd-HHmmss"
$banner  = "=" * 60

Write-Host ""
Write-Host $banner -ForegroundColor Cyan
Write-Host "  AIDEN v3.11 TEST HARNESS - run-all.ps1" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host $banner -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# Pre-flight: verify server alive
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Pre-flight: checking server at $AIDEN_BASE ..." -ForegroundColor DarkGray
if (-not (Test-AidenAlive)) {
    Write-Host ""
    Write-Host "  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    Write-Host "  !! ABORT: Aiden is not responding on port 4200.     !!" -ForegroundColor Red
    Write-Host "  !! Start the server and re-run this script.         !!" -ForegroundColor Red
    Write-Host "  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    Write-Host ""

    # Write a minimal failure report
    $failResult = @([PSCustomObject]@{ Test = "preflight-server"; Pass = $false; Reason = "Server not reachable on $AIDEN_BASE" })
    $failFile   = Save-TierResult -TierName "tier1" -Results $failResult
    $reportPath = Join-Path $ReportDir "TEST_REPORT-$ts.md"
    Build-Report -TierFiles @($failFile) -OutputPath $reportPath
    exit 1
}
Write-Host "  Server OK" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Tier 1 - Smoke
# ---------------------------------------------------------------------------
$t1 = & "$PSScriptRoot\tier1-smoke.ps1"

if ($t1.Abort) {
    Write-Host ""
    Write-Host "Tier 1 aborted - generating partial report and exiting." -ForegroundColor Red
    $reportPath = Join-Path $ReportDir "TEST_REPORT-$ts.md"
    Build-Report -TierFiles @($t1.File) -OutputPath $reportPath
    Write-Host ""
    Write-Host "Report: $reportPath" -ForegroundColor Cyan
    exit 1
}

if ($Tier1Only) {
    $reportPath = Join-Path $ReportDir "TEST_REPORT-$ts.md"
    Build-Report -TierFiles @($t1.File) -OutputPath $reportPath
    Write-Host ""
    Write-Host "Report: $reportPath" -ForegroundColor Cyan
    exit 0
}

# ---------------------------------------------------------------------------
# Tiers 2, 3, 4 - run sequentially (each is independent re: sessions)
# ---------------------------------------------------------------------------
$t2 = & "$PSScriptRoot\tier2-behavior.ps1"

$t3File = $null
if (-not $SkipTier3) {
    $t3 = & "$PSScriptRoot\tier3-quality.ps1"
    $t3File = if ($t3 -and $t3.File) { $t3.File } else { $null }
} else {
    Write-Host "`n=== TIER 3: QUALITY TESTS - SKIPPED (-SkipTier3) ===" -ForegroundColor DarkGray
}

$t4 = & "$PSScriptRoot\tier4-regression.ps1"

# ---------------------------------------------------------------------------
# Merge and report
# ---------------------------------------------------------------------------
$tierFiles = @($t1.File, $t2.File, $t4.File)
if ($t3File) { $tierFiles += $t3File }
$tierFiles = $tierFiles | Where-Object { $_ -and (Test-Path $_) }

$reportPath = Join-Path $ReportDir "TEST_REPORT-$ts.md"
Build-Report -TierFiles $tierFiles -OutputPath $reportPath

# ---------------------------------------------------------------------------
# Final console summary
# ---------------------------------------------------------------------------
$allPassed = $t1.Passed + $t2.Passed + $t4.Passed + $(if ($t3File) { $t3.Passed } else { 0 })
$allTotal  = $t1.Total  + $t2.Total  + $t4.Total  + $(if ($t3File) { $t3.Total  } else { 0 })
$pct       = if ($allTotal -gt 0) { [math]::Round(100 * $allPassed / $allTotal, 1) } else { 0 }

Write-Host ""
Write-Host $banner -ForegroundColor Cyan
Write-Host "  FINAL: $allPassed/$allTotal passed ($pct%)" -ForegroundColor $(if ($allPassed -eq $allTotal) { "Green" } else { "Yellow" })
Write-Host "  Report: $reportPath" -ForegroundColor Cyan
Write-Host $banner -ForegroundColor Cyan
Write-Host ""

exit $(if ($allPassed -eq $allTotal) { 0 } else { 1 })
