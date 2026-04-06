# ============================================================
# DevOS - Aiden LivePulse Monitor
# Copyright (c) 2026 Shiva Deore. All rights reserved.
# ============================================================
# scripts/livepulse.ps1 - Real-time PowerShell dashboard
# showing Aiden's live status: health, providers, cost, models,
# identity, skills, evolution, active tasks.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\livepulse.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\livepulse.ps1 -RefreshSeconds 5

param(
    [int]$RefreshSeconds = 3
)

$API = "http://localhost:4200"
$SEP = "  " + ("-" * 48)

# ---- Helpers ------------------------------------------------

function Get-ApiData($endpoint) {
    try {
        return Invoke-RestMethod "$API$endpoint" -TimeoutSec 2 -ErrorAction Stop
    } catch {
        return $null
    }
}

function Format-Cost($val) {
    if ($null -eq $val) { return "0.0000" }
    return "{0:F4}" -f [double]$val
}

function Write-Section($title) {
    Write-Host ""
    Write-Host "  [$title]" -ForegroundColor Yellow
    Write-Host $SEP -ForegroundColor DarkGray
}

# ---- Main draw ----------------------------------------------

function Draw-Dashboard {
    Clear-Host

    $now = Get-Date -Format "HH:mm:ss  ddd dd-MMM-yyyy"

    Write-Host "+====================================================+" -ForegroundColor Cyan
    Write-Host "|        AIDEN  LIVEPULSE                            |" -ForegroundColor Cyan
    Write-Host "|        $now" -ForegroundColor Cyan
    Write-Host "+====================================================+" -ForegroundColor Cyan

    # ---- Health ---------------------------------------------
    $health = Get-ApiData "/api/health"
    if ($health -and $health.status -eq "ok") {
        Write-Host ""
        Write-Host "  [ONLINE]  v$($health.version)  port 4200" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "  [OFFLINE]  run: npm run dev" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Press Ctrl+C to exit  Retrying every ${RefreshSeconds}s" -ForegroundColor DarkGray
        return
    }

    # ---- Providers ------------------------------------------
    Write-Section "PROVIDERS"
    $prov = Get-ApiData "/api/providers"
    if ($prov -and $prov.apis) {
        $order = 1
        foreach ($api in $prov.apis) {
            if (-not $api.enabled) {
                Write-Host "  [OFF]  $($api.name) ($($api.provider)/$($api.model))" -ForegroundColor DarkGray
                continue
            }
            if ($api.rateLimited) {
                $resetsIn = ""
                if ($api.rateLimitedAt) {
                    $msSince = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) - $api.rateLimitedAt
                    $resetMs = switch ($api.provider) {
                        "groq"       { 15000  }
                        "gemini"     { 90000  }
                        "openrouter" { 30000  }
                        "cerebras"   { 30000  }
                        default      { 60000  }
                    }
                    $remainSec = [math]::Max(0, [math]::Round(($resetMs - $msSince) / 1000))
                    $resetsIn = "  resets in ${remainSec}s"
                }
                Write-Host "  [!!]  $($api.name) ($($api.provider)/$($api.model))  RATE-LIMITED$resetsIn" -ForegroundColor Red
            } else {
                $keyMark = if ($api.hasKey) { "key OK" } else { "NO KEY" }
                Write-Host "  [OK]  #$order  $($api.name) ($($api.provider)/$($api.model))  $keyMark  used $($api.usageCount)x" -ForegroundColor Green
                $order++
            }
        }
        $ollamaModel = if ($prov.ollama -and $prov.ollama.model) { $prov.ollama.model } else { "gemma4:e4b" }
        Write-Host "  [ ~ ]  #$order  ollama ($ollamaModel)  local fallback" -ForegroundColor DarkGray
    } else {
        Write-Host "  (no provider data)" -ForegroundColor DarkGray
    }

    # ---- Local Models (Ollama) ------------------------------
    Write-Section "LOCAL AI  (OLLAMA)"
    $ollama = Get-ApiData "/api/ollama/models"
    if ($ollama -and $ollama.available) {
        if ($ollama.assigned) {
            $a = $ollama.assigned
            $plan = if ($a.planner)   { $a.planner }   else { "none" }
            $resp = if ($a.responder) { $a.responder } else { "none" }
            $code = if ($a.coder)     { $a.coder }     else { "none" }
            $fast = if ($a.fast)      { $a.fast }      else { "none" }
            Write-Host "  planner  : $plan"   -ForegroundColor White
            Write-Host "  responder: $resp"   -ForegroundColor White
            Write-Host "  coder    : $code"   -ForegroundColor DarkGray
            Write-Host "  fast     : $fast"   -ForegroundColor DarkGray
        }
        Write-Host "  -- all models ($($ollama.models.Count)) --" -ForegroundColor DarkGray
        foreach ($m in $ollama.models) {
            $roleTag = if ($m.role -and $m.role -ne "responder") { " [$($m.role)]" } else { "" }
            Write-Host "    - $($m.name)$roleTag" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  [!!]  Ollama not running  start Ollama for local inference" -ForegroundColor Red
    }

    # ---- Cost Today -----------------------------------------
    Write-Section "COST TODAY"
    $cost = Get-ApiData "/api/cost"
    if ($cost) {
        $userC = Format-Cost $cost.userUSD
        $sysC  = Format-Cost $cost.systemUSD
        $totC  = Format-Cost $cost.totalUSD
        Write-Host "  User   : `$$userC" -ForegroundColor White
        Write-Host "  System : `$$sysC"  -ForegroundColor DarkGray
        Write-Host "  Total  : `$$totC"  -ForegroundColor Cyan
        if ($cost.byProvider) {
            $hasAny = $false
            $cost.byProvider.PSObject.Properties | Where-Object { $_.Value -gt 0 } | ForEach-Object {
                if (-not $hasAny) {
                    Write-Host "  by provider:" -ForegroundColor DarkGray
                    $hasAny = $true
                }
                Write-Host "    $($_.Name): `$$(Format-Cost $_.Value)" -ForegroundColor DarkGray
            }
        }
    } else {
        Write-Host "  No cost data yet" -ForegroundColor DarkGray
    }

    # ---- Identity -------------------------------------------
    $identity = Get-ApiData "/api/identity"
    if ($identity -and $identity.level) {
        Write-Section "AIDEN IDENTITY"
        Write-Host "  Level $($identity.level)  $($identity.title)" -ForegroundColor Cyan
        $xpBar = ""
        if ($identity.xpProgress) {
            $filled = [math]::Round($identity.xpProgress * 20)
            $empty  = 20 - $filled
            $xpBar  = "[" + ("=" * $filled) + (" " * $empty) + "]  XP $($identity.xp)/$([int]$identity.xp + [int]$identity.xpToNextLevel)"
        }
        if ($xpBar) { Write-Host "  $xpBar" -ForegroundColor DarkGray }
        $line = "  $($identity.skillsLearned) skills"
        if ($identity.streakDays -gt 0)  { $line += "  streak $($identity.streakDays)d" }
        if ($identity.topStrength)       { $line += "  top: $($identity.topStrength)" }
        Write-Host $line -ForegroundColor DarkGray
    }

    # ---- Evolution ------------------------------------------
    $evo = Get-ApiData "/api/evolution"
    if ($evo -and $evo.summary) {
        Write-Section "EVOLUTION"
        Write-Host "  $($evo.summary)" -ForegroundColor DarkGray
        if ($evo.stats) {
            $s      = $evo.stats
            $avgPct = if ($s.avgSuccessRate) { "{0:F0}%" -f ($s.avgSuccessRate * 100) } else { "?" }
            $attn   = if ($s.needsAttention) { $s.needsAttention } else { 0 }
            Write-Host "  executions: $($s.totalExecutions)  success: $avgPct  needs attention: $attn" -ForegroundColor DarkGray
        }
    }

    # ---- Active Tasks ---------------------------------------
    $tasks = Get-ApiData "/api/tasks"
    if ($tasks) {
        $activeTasks = @($tasks | Where-Object { $_.status -eq "running" -or $_.status -eq "pending" })
        if ($activeTasks.Count -gt 0) {
            Write-Section "ACTIVE TASKS ($($activeTasks.Count))"
            foreach ($t in $activeTasks | Select-Object -First 5) {
                $goal = if ($t.goal.Length -gt 50) { $t.goal.Substring(0,50) + "..." } else { $t.goal }
                Write-Host "  [>] [$($t.status.ToUpper())]  $goal" -ForegroundColor Magenta
                Write-Host "      step $($t.progress)" -ForegroundColor DarkGray
            }
        }
    }

    # ---- Skills ---------------------------------------------
    $skills = Get-ApiData "/api/skills"
    if ($skills) {
        $count = if ($skills -is [array]) { $skills.Count } else { 0 }
        Write-Host ""
        Write-Host "  SKILLS: $count loaded" -ForegroundColor DarkGray
    }

    # ---- Footer ---------------------------------------------
    Write-Host ""
    Write-Host $SEP -ForegroundColor DarkGray
    Write-Host "  Ctrl+C to exit  refresh every ${RefreshSeconds}s  $API" -ForegroundColor DarkGray
}

# ---- Entry --------------------------------------------------

Write-Host "Starting Aiden LivePulse..." -ForegroundColor Cyan
Write-Host "(Ctrl+C to stop)" -ForegroundColor DarkGray
Start-Sleep 1

while ($true) {
    Draw-Dashboard
    Start-Sleep $RefreshSeconds
}
