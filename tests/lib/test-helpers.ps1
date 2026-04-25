# test-helpers.ps1 - Shared functions for Aiden v3.11 test harness
# Source this file at the top of every tier script:
#   . "$PSScriptRoot\lib\test-helpers.ps1"

$AIDEN_BASE = "http://localhost:4200"
$RESULTS_DIR = Join-Path $PSScriptRoot "..\results"

# ---------------------------------------------------------------------------
# Call-Aiden
# ---------------------------------------------------------------------------
function Call-Aiden {
    param(
        [Parameter(Mandatory)][string]$Message,
        [string]$SessionId = ("sess-" + [guid]::NewGuid().ToString("N").Substring(0,8)),
        [int]$TimeoutSec = 30,
        [switch]$UseSSE
    )

    $url = "$AIDEN_BASE/api/chat"
    $body = @{ message = $Message; sessionId = $SessionId } | ConvertTo-Json -Compress
    $headers = @{ "Content-Type" = "application/json" }
    if ($UseSSE) { $headers["Accept"] = "text/event-stream" }

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $resp = Invoke-WebRequest -Uri $url -Method POST -Body $body -Headers $headers `
            -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
        $sw.Stop()

        $raw = $resp.Content
        $parsed = $null
        try { $parsed = $raw | ConvertFrom-Json } catch {}

        $responseText = ""
        $provider     = ""
        $model        = ""
        if ($parsed) {
            $responseText = if ($parsed.PSObject.Properties["message"])      { $parsed.message }
                            elseif ($parsed.PSObject.Properties["response"]) { $parsed.response }
                            elseif ($parsed.PSObject.Properties["text"])     { $parsed.text }
                            else { $raw }
            $provider = if ($parsed.PSObject.Properties["provider"]) { $parsed.provider } else { "" }
            $model    = if ($parsed.PSObject.Properties["model"])    { $parsed.model }    else { "" }
        } else {
            $responseText = $raw
        }

        return [PSCustomObject]@{
            Response      = $responseText
            ElapsedMs     = $sw.ElapsedMilliseconds
            HttpStatus    = [int]$resp.StatusCode
            Provider      = $provider
            ProviderModel = $model
            ErrorText     = ""
            RawJson       = $raw
        }
    } catch {
        $sw.Stop()
        return [PSCustomObject]@{
            Response      = ""
            ElapsedMs     = $sw.ElapsedMilliseconds
            HttpStatus    = 0
            Provider      = ""
            ProviderModel = ""
            ErrorText     = $_.Exception.Message
            RawJson       = ""
        }
    }
}

# ---------------------------------------------------------------------------
# Assertion helpers - all return {Pass, Reason}
# ---------------------------------------------------------------------------
function Assert-NotEmpty {
    param([string]$Value, [string]$TestName)
    $pass = ($null -ne $Value) -and ($Value.Trim().Length -gt 0)
    return [PSCustomObject]@{ Pass = $pass; Reason = if ($pass) { "non-empty" } else { "value was empty or null" } }
}

function Assert-Contains {
    param([string]$Value, [string]$Expected, [string]$TestName)
    $pass = $Value -match [regex]::Escape($Expected)
    return [PSCustomObject]@{ Pass = $pass; Reason = if ($pass) { "found '$Expected'" } else { "missing '$Expected' in: $($Value.Substring(0,[Math]::Min(120,$Value.Length)))" } }
}

function Assert-NotContains {
    param([string]$Value, [string]$Expected, [string]$TestName)
    foreach ($item in $Expected) {
        if ([string]::IsNullOrWhiteSpace($item)) { continue }   # skip empty strings
        if ($Value -match [regex]::Escape($item)) {
            return [PSCustomObject]@{ Pass = $false; Reason = "LEAKED '$item' in: $($Value.Substring(0,[Math]::Min(120,$Value.Length)))" }
        }
    }
    return [PSCustomObject]@{ Pass = $true; Reason = "correctly absent '$Expected'" }
}

function Assert-MatchesRegex {
    param([string]$Value, [string]$Pattern, [string]$TestName)
    $pass = $Value -match $Pattern
    return [PSCustomObject]@{ Pass = $pass; Reason = if ($pass) { "matched /$Pattern/" } else { "no match for /$Pattern/ in: $($Value.Substring(0,[Math]::Min(120,$Value.Length)))" } }
}

function Assert-LessThan {
    param([long]$Value, [long]$Threshold, [string]$TestName)
    $pass = $Value -lt $Threshold
    return [PSCustomObject]@{ Pass = $pass; Reason = if ($pass) { "${Value}ms < ${Threshold}ms" } else { "${Value}ms >= ${Threshold}ms (too slow)" } }
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
$script:_logBuffer = @()

function Log-TestStart {
    param([string]$TestName)
    Write-Host "  [ RUN ] $TestName" -ForegroundColor Cyan
}

function Log-TestResult {
    param([string]$TestName, [bool]$Pass, [string]$Reason)
    if ($Pass) {
        Write-Host "  [ OK  ] $TestName - $Reason" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $TestName - $Reason" -ForegroundColor Red
    }
    $script:_logBuffer += [PSCustomObject]@{ Test = $TestName; Pass = $Pass; Reason = $Reason }
}

# ---------------------------------------------------------------------------
# Save-TierResult
# ---------------------------------------------------------------------------
function Save-TierResult {
    param([string]$TierName, [array]$Results)

    if (-not (Test-Path $RESULTS_DIR)) {
        New-Item -ItemType Directory -Force -Path $RESULTS_DIR | Out-Null
    }

    $ts   = Get-Date -Format "yyyyMMdd-HHmmss"
    $file = Join-Path $RESULTS_DIR "$TierName-$ts.json"

    $summary = [PSCustomObject]@{
        tier      = $TierName
        timestamp = (Get-Date -Format "o")
        total     = $Results.Count
        passed    = ($Results | Where-Object { $_.Pass }).Count
        failed    = ($Results | Where-Object { -not $_.Pass }).Count
        tests     = $Results
    }

    $summary | ConvertTo-Json -Depth 5 | Out-File -FilePath $file -Encoding utf8
    Write-Host "  Saved results -> $file" -ForegroundColor DarkGray
    return $file
}

# ---------------------------------------------------------------------------
# Server health check utility (used by run-all.ps1)
# ---------------------------------------------------------------------------
function Test-AidenAlive {
    try {
        $r = Invoke-WebRequest -Uri "$AIDEN_BASE/api/health" -Method GET `
            -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        return [int]$r.StatusCode -eq 200
    } catch {
        return $false
    }
}
