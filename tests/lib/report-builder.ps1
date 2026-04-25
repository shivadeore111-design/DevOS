# report-builder.ps1 - Generate markdown test report from tier JSON results
# Usage: . "$PSScriptRoot\report-builder.ps1"; Build-Report -TierFiles @(...) -OutputPath "..."

function Build-Report {
    param(
        [Parameter(Mandatory)][string[]]$TierFiles,
        [Parameter(Mandatory)][string]$OutputPath
    )

    $allResults = @()
    $tierSummaries = @{}

    foreach ($f in $TierFiles) {
        if (-not (Test-Path $f)) { continue }
        try {
            $data = Get-Content $f -Raw | ConvertFrom-Json
            $tier = $data.tier
            $tierSummaries[$tier] = $data
            foreach ($test in $data.tests) {
                $allResults += [PSCustomObject]@{
                    Tier   = $tier
                    Test   = $test.Test
                    Pass   = [bool]$test.Pass
                    Reason = $test.Reason
                    Group  = if ($test.PSObject.Properties["Group"]) { $test.Group } else { "" }
                    Scores = if ($test.PSObject.Properties["Scores"]) { $test.Scores } else { $null }
                }
            }
        } catch {
            Write-Warning "Could not parse $f : $_"
        }
    }

    $totalPassed = ($allResults | Where-Object { $_.Pass }).Count
    $totalTests  = $allResults.Count
    $passRate    = if ($totalTests -gt 0) { [math]::Round(100 * $totalPassed / $totalTests, 1) } else { 0 }
    $ts          = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    # Triage
    $critical = @()
    $high     = @()
    $medium   = @()
    $low      = @()

    foreach ($r in ($allResults | Where-Object { -not $_.Pass })) {
        $sev = Get-Severity $r
        switch ($sev) {
            "CRITICAL" { $critical += $r }
            "HIGH"     { $high     += $r }
            "MEDIUM"   { $medium   += $r }
            "LOW"      { $low      += $r }
        }
    }

    $sb = [System.Text.StringBuilder]::new()

    # Header
    [void]$sb.AppendLine("# Aiden v3.11 Test Report")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("**Generated:** $ts")
    [void]$sb.AppendLine("**Overall:** $totalPassed/$totalTests passed ($passRate%)")
    [void]$sb.AppendLine("")

    # Summary table
    [void]$sb.AppendLine("## Summary")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Tier | Passed | Total | Pass Rate | Status |")
    [void]$sb.AppendLine("|------|--------|-------|-----------|--------|")

    foreach ($tier in @("tier1","tier2","tier3","tier4")) {
        if ($tierSummaries.ContainsKey($tier)) {
            $ts2 = $tierSummaries[$tier]
            $rate = if ($ts2.total -gt 0) { [math]::Round(100 * $ts2.passed / $ts2.total, 0) } else { 0 }
            $icon = if ($ts2.passed -eq $ts2.total) { "[PASS]" } else { "[FAIL]" }
            [void]$sb.AppendLine("| $tier | $($ts2.passed) | $($ts2.total) | $rate% | $icon |")
        } else {
            [void]$sb.AppendLine("| $tier | - | - | - | [SKIP] skipped |")
        }
    }
    [void]$sb.AppendLine("")

    # Triage section
    [void]$sb.AppendLine("## Triage")
    [void]$sb.AppendLine("")

    if ($critical.Count -gt 0) {
        [void]$sb.AppendLine("### ?? CRITICAL ($($critical.Count))")
        foreach ($r in $critical) { [void]$sb.AppendLine("- **$($r.Test)**: $($r.Reason)") }
        [void]$sb.AppendLine("")
    }
    if ($high.Count -gt 0) {
        [void]$sb.AppendLine("### ?? HIGH ($($high.Count))")
        foreach ($r in $high) { [void]$sb.AppendLine("- **$($r.Test)**: $($r.Reason)") }
        [void]$sb.AppendLine("")
    }
    if ($medium.Count -gt 0) {
        [void]$sb.AppendLine("### ?? MEDIUM ($($medium.Count))")
        foreach ($r in $medium) { [void]$sb.AppendLine("- **$($r.Test)**: $($r.Reason)") }
        [void]$sb.AppendLine("")
    }
    if ($low.Count -gt 0) {
        [void]$sb.AppendLine("### ?? LOW ($($low.Count))")
        foreach ($r in $low) { [void]$sb.AppendLine("- **$($r.Test)**: $($r.Reason)") }
        [void]$sb.AppendLine("")
    }
    if ($critical.Count + $high.Count + $medium.Count + $low.Count -eq 0) {
        [void]$sb.AppendLine("[PASS] No failures to triage.")
        [void]$sb.AppendLine("")
    }

    # Per-tier detail tables
    foreach ($tier in @("tier1","tier2","tier3","tier4")) {
        if (-not $tierSummaries.ContainsKey($tier)) { continue }
        [void]$sb.AppendLine("## $tier Detail")
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("| Test | Pass | Reason |")
        [void]$sb.AppendLine("|------|------|--------|")
        foreach ($r in ($allResults | Where-Object { $_.Tier -eq $tier })) {
            $icon   = if ($r.Pass) { "[PASS]" } else { "[FAIL]" }
            $reason = $r.Reason -replace '\|', '\|'
            [void]$sb.AppendLine("| $($r.Test) | $icon | $reason |")
        }
        [void]$sb.AppendLine("")

        # Quality scores table for tier3
        if ($tier -eq "tier3") {
            $scored = $allResults | Where-Object { $_.Tier -eq "tier3" -and $_.Scores -ne $null }
            if ($scored.Count -gt 0) {
                [void]$sb.AppendLine("### Quality Scores")
                [void]$sb.AppendLine("")
                [void]$sb.AppendLine("| Test | Accuracy | Helpfulness | Tone | Appropriateness | Notes |")
                [void]$sb.AppendLine("|------|----------|-------------|------|-----------------|-------|")
                foreach ($r in $scored) {
                    $s = $r.Scores
                    $notes = if ($s.PSObject.Properties["notes"]) { $s.notes } else { "" }
                    [void]$sb.AppendLine("| $($r.Test) | $($s.accuracy) | $($s.helpfulness) | $($s.tone) | $($s.appropriateness) | $notes |")
                }
                [void]$sb.AppendLine("")
            }
        }
    }

    # Recommended next session
    [void]$sb.AppendLine("## Recommended Next Session")
    [void]$sb.AppendLine("")
    if ($critical.Count -gt 0) {
        [void]$sb.AppendLine("[WARN]? **STOP** - resolve CRITICAL failures before any other work:")
        foreach ($r in $critical) { [void]$sb.AppendLine("  - Fix: $($r.Test) - $($r.Reason)") }
    } elseif ($high.Count -gt 0) {
        [void]$sb.AppendLine("Prioritize HIGH severity failures:")
        foreach ($r in $high) { [void]$sb.AppendLine("  - Fix: $($r.Test) - $($r.Reason)") }
    } elseif ($medium.Count -gt 0) {
        [void]$sb.AppendLine("Address MEDIUM severity issues (latency / format):")
        foreach ($r in $medium) { [void]$sb.AppendLine("  - $($r.Test) - $($r.Reason)") }
    } else {
        [void]$sb.AppendLine("All critical and high-priority tests pass. Continue with feature work.")
    }
    [void]$sb.AppendLine("")

    $sb.ToString() | Out-File -FilePath $OutputPath -Encoding utf8
    Write-Host "Report written to: $OutputPath" -ForegroundColor Green
    return $OutputPath
}

# ---------------------------------------------------------------------------
# Severity classification
# ---------------------------------------------------------------------------
function Get-Severity {
    param([PSCustomObject]$Result)

    $test   = $Result.Test
    $reason = $Result.Reason

    # Server not alive
    if ($test -match "T1-health") { return "CRITICAL" }

    # Regression failures
    if ($test -match "^R\d") { return "CRITICAL" }

    # Name/vendor leaks
    if ($reason -match "ClawPack|Neurometric|Claude|LEAKED") { return "HIGH" }
    if ($test -match "A1-identity|A2-model") { return "HIGH" }

    # Quality averages below 3
    if ($test -match "^Q") {
        if ($Result.Scores) {
            $dims = @("accuracy","helpfulness","tone","appropriateness")
            foreach ($d in $dims) {
                if ($Result.Scores.PSObject.Properties[$d] -and [int]$Result.Scores.$d -lt 2) { return "HIGH" }
            }
        }
        return "HIGH"
    }

    # Fast-path latency
    if ($test -match "^E\d") { return "MEDIUM" }
    if ($reason -match "too slow|>=.*ms") { return "MEDIUM" }

    # Haiku format, one-sentence format
    if ($test -match "F1-haiku") { return "LOW" }
    if ($test -match "F2-one-sentence|F3-list") { return "LOW" }

    # Default
    return "MEDIUM"
}
