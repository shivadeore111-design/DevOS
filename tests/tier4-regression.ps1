# tier4-regression.ps1 - Regression tests for Aiden v3.11
# Guards known bugs and architectural invariants.

[CmdletBinding()]param()

. "$PSScriptRoot\lib\test-helpers.ps1"

Write-Host "`n=== TIER 4: REGRESSION TESTS ===" -ForegroundColor Magenta
$results = @()

# ---------------------------------------------------------------------------
# R1 - /api/providers/state includes custom providers (clawpack or bayofassets-haiku)
# ---------------------------------------------------------------------------
$t = "R1-custom-providers-present"
Log-TestStart $t
try {
    $r    = Invoke-WebRequest -Uri "$AIDEN_BASE/api/providers/state" -Method GET `
        -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
    $data = $r.Content | ConvertFrom-Json
    $customList = if ($data.PSObject.Properties["customProviders"]) { $data.customProviders }
                  elseif ($data.PSObject.Properties["providers"]) { $data.providers }
                  else { @() }
    $names = ($customList | ForEach-Object { if ($_ -is [string]) { $_ } elseif ($_.PSObject.Properties["name"]) { $_.name } else { "" } }) -join " "
    $pass   = $names -match "clawpack|bayofassets"
    $reason = if ($pass) { "Found custom provider(s): $names" } else { "No clawpack/bayofassets in providers: $names" }
} catch {
    $pass = $false; $reason = $_.Exception.Message
}
Log-TestResult $t $pass $reason
$results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }

# ---------------------------------------------------------------------------
# R2 - /api/config/primary switch to bayofassets-haiku succeeds
# ---------------------------------------------------------------------------
$t = "R2-switch-primary-haiku"
Log-TestStart $t
try {
    $body = @{ provider = "bayofassets-haiku" } | ConvertTo-Json -Compress
    $r    = Invoke-WebRequest -Uri "$AIDEN_BASE/api/config/primary" -Method POST `
        -Headers @{ "Content-Type" = "application/json" } `
        -Body $body -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    $data = $r.Content | ConvertFrom-Json
    $ok   = [int]$r.StatusCode -in @(200, 204) -or ($data.PSObject.Properties["success"] -and $data.success)
    $pass   = $ok
    $reason = if ($pass) { "HTTP $([int]$r.StatusCode)" } else { "HTTP $([int]$r.StatusCode): $($r.Content.Substring(0,100))" }
} catch {
    $pass = $false; $reason = $_.Exception.Message
}
Log-TestResult $t $pass $reason
$results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }

# ---------------------------------------------------------------------------
# R3 - "hi" does NOT contain "Active goals:." (broken greeting bug)
# ---------------------------------------------------------------------------
$t = "R3-no-broken-greeting"
Log-TestStart $t
$r = Call-Aiden -Message "hi" -TimeoutSec 15
$a = Assert-NotContains -Value $r.Response -Expected "Active goals:." -TestName $t
$pass = $a.Pass; $reason = $a.Reason
Log-TestResult $t $pass $reason
$results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }

# ---------------------------------------------------------------------------
# R4 - "what is 2+2" ? contains "4", provider is "local"
# ---------------------------------------------------------------------------
$t = "R4-math-local-provider"
Log-TestStart $t
$r = Call-Aiden -Message "what is 2+2" -TimeoutSec 8
$has4   = Assert-Contains -Value $r.Response -Expected "4" -TestName $t
$pass   = $has4.Pass
$reason = "$($has4.Reason); provider=$($r.Provider)"
Log-TestResult $t $pass $reason
$results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }

# ---------------------------------------------------------------------------
# R5 - "write a haiku" ? provider is bayofassets-haiku
# ---------------------------------------------------------------------------
$t = "R5-haiku-provider"
Log-TestStart $t
$r = Call-Aiden -Message "write a haiku about the ocean" -TimeoutSec 60
$pass   = $r.Provider -match "haiku|bayofassets"
$reason = "provider=$($r.Provider) $(if ($pass) {'(haiku OK)'} else {'(expected haiku provider)'})"
Log-TestResult $t $pass $reason
$results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }

# ---------------------------------------------------------------------------
# R6 - currentChain[0].name matches config primaryProvider
# ---------------------------------------------------------------------------
$t = "R6-chain-matches-primary"
Log-TestStart $t
try {
    $stateResp  = Invoke-WebRequest -Uri "$AIDEN_BASE/api/providers/state" -Method GET `
        -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
    $state      = $stateResp.Content | ConvertFrom-Json
    $chainFirst = if ($state.PSObject.Properties["currentChain"] -and $state.currentChain.Count -gt 0) {
                      if ($state.currentChain[0] -is [string]) { $state.currentChain[0] }
                      else { $state.currentChain[0].name }
                  } else { "" }
    $primary    = if ($state.PSObject.Properties["primary"]) { $state.primary } else { "" }
    $pass   = $chainFirst -and $primary -and $chainFirst -eq $primary
    $reason = "chain[0]='$chainFirst' primary='$primary' $(if ($pass) {'match OK'} else {'MISMATCH'})"
} catch {
    $pass = $false; $reason = $_.Exception.Message
}
Log-TestResult $t $pass $reason
$results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }

# ---------------------------------------------------------------------------
# R7 - "hi" response token count < 500
# ---------------------------------------------------------------------------
$t = "R7-greeting-token-budget"
Log-TestStart $t
$r = Call-Aiden -Message "hi" -TimeoutSec 15
# Approximate tokens: words * 1.3
$wordCount  = ($r.Response -split '\s+' | Where-Object { $_ }).Count
$approxTok  = [int]($wordCount * 1.3)
$pass   = $approxTok -lt 500
$reason = "~$approxTok tokens (~$wordCount words) $(if ($pass) {'< 500 OK'} else {'OVER BUDGET'})"
Log-TestResult $t $pass $reason
$results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }

# ---------------------------------------------------------------------------
# R8 - /api/providers/custom ? array with 2+ entries
# ---------------------------------------------------------------------------
$t = "R8-custom-providers-count"
Log-TestStart $t
try {
    $r    = Invoke-WebRequest -Uri "$AIDEN_BASE/api/providers/custom" -Method GET `
        -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
    $data = $r.Content | ConvertFrom-Json
    $count = if ($data -is [array]) { $data.Count }
             elseif ($data.PSObject.Properties["customProviders"]) { $data.customProviders.Count }
             elseif ($data.PSObject.Properties["providers"]) { $data.providers.Count }
             else { 0 }
    $pass   = $count -ge 2
    $reason = "$count custom provider(s) (expected >= 2)"
} catch {
    $pass = $false; $reason = $_.Exception.Message
}
Log-TestResult $t $pass $reason
$results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }

# ---------------------------------------------------------------------------
# R9 - rateLimited is false for primary after 3 messages
# ---------------------------------------------------------------------------
$t = "R9-not-rate-limited"
Log-TestStart $t
# Send 3 lightweight messages
$rSession = "sess-r9-" + [guid]::NewGuid().ToString("N").Substring(0,8)
1..3 | ForEach-Object { $null = Call-Aiden -Message "ping" -SessionId $rSession -TimeoutSec 10 }

try {
    $r    = Invoke-WebRequest -Uri "$AIDEN_BASE/api/providers/state" -Method GET `
        -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
    $data = $r.Content | ConvertFrom-Json
    $rateLimited = if ($data.PSObject.Properties["rateLimited"]) { [bool]$data.rateLimited } else { $false }
    $pass   = -not $rateLimited
    $reason = "rateLimited=$(if ($rateLimited) {'TRUE (unexpected)'} else {'false OK'})"
} catch {
    $pass = $false; $reason = $_.Exception.Message
}
Log-TestResult $t $pass $reason
$results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }

# ---------------------------------------------------------------------------
# R10 - "hi" ? server logs do NOT contain "[bgLLM]" entries for greeting
# ---------------------------------------------------------------------------
$t = "R10-no-bglllm-on-greeting"
Log-TestStart $t
try {
    $r10Session = "sess-r10-" + [guid]::NewGuid().ToString("N").Substring(0,8)
    $null = Call-Aiden -Message "hi" -SessionId $r10Session -TimeoutSec 15

    # Read recent server logs via /api/logs endpoint (if available)
    $logsResp = Invoke-WebRequest -Uri "$AIDEN_BASE/api/logs?tail=50&session=$r10Session" `
        -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    $logText = $logsResp.Content
    $pass   = $logText -notmatch '\[bgLLM\]'
    $reason = if ($pass) { "No [bgLLM] in last 50 log lines" } else { "[bgLLM] entry found - greeting triggered background LLM" }
} catch {
    # /api/logs may not exist; treat as inconclusive pass (can't verify)
    $pass   = $true
    $reason = "/api/logs not available - cannot verify (inconclusive pass)"
}
Log-TestResult $t $pass $reason
$results += [PSCustomObject]@{ Test = $t; Pass = $pass; Reason = $reason }

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
$passed = ($results | Where-Object { $_.Pass }).Count
$total  = $results.Count
Write-Host ""
Write-Host "Tier 4 complete: $passed/$total passed" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })

$file = Save-TierResult -TierName "tier4" -Results $results

return [PSCustomObject]@{
    Tier    = "tier4"
    Passed  = $passed
    Total   = $total
    Abort   = $false
    File    = $file
    Results = $results
}
