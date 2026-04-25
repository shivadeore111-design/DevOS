# tier1-smoke.ps1 - Smoke tests for Aiden v3.11
# Verifies basic server reachability and minimum functionality.
# If T1 (health check) fails, remaining tests are skipped.

[CmdletBinding()]param()

. "$PSScriptRoot\lib\test-helpers.ps1"

Write-Host "`n=== TIER 1: SMOKE TESTS ===" -ForegroundColor Magenta
$results = @()
$abort   = $false

# ---------------------------------------------------------------------------
# T1 - GET /api/health ? 200
# ---------------------------------------------------------------------------
$t = "T1-health-check"
Log-TestStart $t
try {
    $r = Invoke-WebRequest -Uri "$AIDEN_BASE/api/health" -Method GET `
        -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
    $pass   = [int]$r.StatusCode -eq 200
    $reason = if ($pass) { "HTTP 200" } else { "HTTP $([int]$r.StatusCode)" }
} catch {
    $pass   = $false
    $reason = "Connection refused or timeout: $($_.Exception.Message)"
}
Log-TestResult $t $pass $reason
$results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }

if (-not $pass) {
    Write-Host ""
    Write-Host "  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    Write-Host "  !! CRITICAL: Aiden server is not responding on      !!" -ForegroundColor Red
    Write-Host "  !! http://localhost:4200 - all further tests aborted !!" -ForegroundColor Red
    Write-Host "  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    Write-Host ""
    $abort = $true
}

# ---------------------------------------------------------------------------
# T2 - BayOfAssets reachable (read key from config, direct POST)
# ---------------------------------------------------------------------------
$t = "T2-bayofassets-reachable"
if (-not $abort) {
    Log-TestStart $t
    $bayKey = ""
    try {
        $cfgPath = Join-Path $PSScriptRoot "..\config\devos.config.json"
        $cfgPath = [System.IO.Path]::GetFullPath($cfgPath)
        if (Test-Path $cfgPath) {
            $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
            $bayEntry = $cfg.customProviders | Where-Object { $_.id -eq "bayofassets-haiku" -and $_.enabled -eq $true }
            if ($bayEntry) {
                $bayKey = $bayEntry.apiKey
            }
        }
    } catch {
        $bayKey = ""
    }

    if ($bayKey -and $bayKey.Length -gt 8) {
        try {
            $testBody = @{
                model    = "claude-haiku-4-5"
                messages = @(@{ role = "user"; content = "ping" })
                max_tokens = 16
            } | ConvertTo-Json -Compress

            $boaResp = Invoke-WebRequest -Uri "https://api.bayofassets.com/v1/chat/completions" `
                -Method POST `
                -Headers @{ "Authorization" = "Bearer $bayKey"; "Content-Type" = "application/json" } `
                -Body $testBody `
                -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop

            $pass   = [int]$boaResp.StatusCode -eq 200 -and $boaResp.Content.Length -gt 0
            $reason = if ($pass) { "HTTP 200, content received" } else { "HTTP $([int]$boaResp.StatusCode)" }
        } catch {
            $pass   = $false
            $reason = "BayOfAssets API error: $($_.Exception.Message)"
        }
    } else {
        $pass   = $false
        $reason = "Could not read BayOfAssets key from /api/config"
    }

    Log-TestResult $t $pass $reason
    $results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }
}

# ---------------------------------------------------------------------------
# T3 - GET /api/skills ? 200, array length ? 100
# ---------------------------------------------------------------------------
$t = "T3-skills-endpoint"
if (-not $abort) {
    Log-TestStart $t
    try {
        $r    = Invoke-WebRequest -Uri "$AIDEN_BASE/api/skills" -Method GET `
            -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
        $data = $r.Content | ConvertFrom-Json
        $len  = if ($data -is [array]) { $data.Count }
                elseif ($data.PSObject.Properties["skills"]) { $data.skills.Count }
                else { 0 }
        $pass   = [int]$r.StatusCode -eq 200 -and $len -ge 100
        $reason = if ($pass) { "HTTP 200, $len skills" } else { "HTTP $([int]$r.StatusCode), count=$len (expected >=100)" }
    } catch {
        $pass   = $false
        $reason = $_.Exception.Message
    }
    Log-TestResult $t $pass $reason
    $results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }
}

# ---------------------------------------------------------------------------
# T4 - GET /api/providers/state ? 200, primary set, currentChain[0] exists
# ---------------------------------------------------------------------------
$t = "T4-providers-state"
if (-not $abort) {
    Log-TestStart $t
    try {
        $r    = Invoke-WebRequest -Uri "$AIDEN_BASE/api/providers/state" -Method GET `
            -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
        $data = $r.Content | ConvertFrom-Json
        $hasPrimary = $data.PSObject.Properties["primary"] -and $data.primary
        $hasChain   = $data.PSObject.Properties["currentChain"] -and $data.currentChain.Count -gt 0
        $pass   = [int]$r.StatusCode -eq 200 -and $hasPrimary -and $hasChain
        $reason = if ($pass) {
            "primary=$($data.primary), chain[0]=$($data.currentChain[0].name)"
        } else {
            "HTTP $([int]$r.StatusCode) primary=$hasPrimary chain=$hasChain"
        }
    } catch {
        $pass   = $false
        $reason = $_.Exception.Message
    }
    Log-TestResult $t $pass $reason
    $results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }
}

# ---------------------------------------------------------------------------
# T5 - Call-Aiden "hi" ? non-empty within 10s
# ---------------------------------------------------------------------------
$t = "T5-basic-response"
if (-not $abort) {
    Log-TestStart $t
    $r = Call-Aiden -Message "hi" -TimeoutSec 10
    if ($r.HttpStatus -eq 0) {
        $pass   = $false
        $reason = "No response: $($r.ErrorText)"
    } else {
        $a      = Assert-NotEmpty -Value $r.Response -TestName $t
        $pass   = $a.Pass -and $r.ElapsedMs -lt 10000
        $reason = if ($pass) { "$($r.Response.Substring(0,[Math]::Min(60,$r.Response.Length)))... ($($r.ElapsedMs)ms)" } else { $a.Reason }
    }
    Log-TestResult $t $pass $reason
    $results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }
}

# ---------------------------------------------------------------------------
# T6 - Call-Aiden "what is 2+2" ? contains "4" within 5s
# ---------------------------------------------------------------------------
$t = "T6-math-fast-path"
if (-not $abort) {
    Log-TestStart $t
    $r = Call-Aiden -Message "what is 2+2" -TimeoutSec 5
    if ($r.HttpStatus -eq 0) {
        $pass   = $false
        $reason = "No response: $($r.ErrorText)"
    } else {
        $hasAnswer = Assert-Contains -Value $r.Response -Expected "4" -TestName $t
        $isfast    = Assert-LessThan -Value $r.ElapsedMs -Threshold 5000 -TestName $t
        $pass   = $hasAnswer.Pass -and $isfast.Pass
        $reason = "$($hasAnswer.Reason); $($isfast.Reason)"
    }
    Log-TestResult $t $pass $reason
    $results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
$passed = ($results | Where-Object { $_.Pass }).Count
$total  = $results.Count
Write-Host ""
Write-Host "Tier 1 complete: $passed/$total passed" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })

$file = Save-TierResult -TierName "tier1" -Results $results

# Return exit data for run-all.ps1
return [PSCustomObject]@{
    Tier    = "tier1"
    Passed  = $passed
    Total   = $total
    Abort   = $abort
    File    = $file
    Results = $results
}
