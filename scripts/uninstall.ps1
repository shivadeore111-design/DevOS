# =============================================================
# Aiden — Windows Uninstaller
# =============================================================
# Usage (one-liner):
#   powershell -ExecutionPolicy Bypass -File scripts\uninstall.ps1
#
# Or via npm:
#   npm run uninstall
#
# Or via Aiden CLI (inside chat):
#   /uninstall
# =============================================================

param(
  [switch]$KeepWorkspace,   # keep workspace/ folder (conversations, memory, skills)
  [switch]$KeepConfig,      # keep %APPDATA%\aiden (config, browser profiles)
  [switch]$Yes              # skip all confirmation prompts
)

$ErrorActionPreference = 'SilentlyContinue'

$BOLD  = "`e[1m"
$RED   = "`e[31m"
$GREEN = "`e[32m"
$CYAN  = "`e[36m"
$DIM   = "`e[2m"
$RST   = "`e[0m"

Write-Host ""
Write-Host ($BOLD + "Aiden - Uninstaller" + $RST)
Write-Host "${DIM}────────────────────────────────────${RST}"
Write-Host ""

$removed = 0
$skipped = 0

function Remove-AidenPath {
  param([string]$Path, [string]$Label)
  if (Test-Path $Path) {
    Remove-Item -Recurse -Force -Path $Path -ErrorAction SilentlyContinue
    Write-Host "  ${GREEN}removed${RST}  $Label"
    $script:removed++
  } else {
    Write-Host "  ${DIM}skipped${RST}  $Label ${DIM}(not found)${RST}"
    $script:skipped++
  }
}

# ── Step 1 — Kill running Aiden processes ──────────────────────────────────────

Write-Host "Stopping Aiden server (port 4200)..."
$portProc = Get-NetTCPConnection -LocalPort 4200 -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1 -ExpandProperty OwningProcess
if ($portProc) {
  Stop-Process -Id $portProc -Force -ErrorAction SilentlyContinue
  Write-Host "  ${GREEN}stopped${RST}  process $portProc (was listening on :4200)"
} else {
  Write-Host "  ${DIM}skipped${RST}  no process on port 4200"
}

# Kill any node process named aiden / devos
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
  $_.MainWindowTitle -like "*aiden*" -or $_.CommandLine -like "*aiden*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host ""

# ── Step 2 — AppData (config, browser profiles, cache) ────────────────────────

if (-not $KeepConfig) {
  if ($env:APPDATA)      { $appData   = $env:APPDATA }      else { $appData   = Join-Path $env:USERPROFILE "AppData\Roaming" }
  if ($env:LOCALAPPDATA) { $localData = $env:LOCALAPPDATA } else { $localData = Join-Path $env:USERPROFILE "AppData\Local"  }

  Write-Host "Removing Aiden user data..."
  Remove-AidenPath (Join-Path $appData   "aiden")        "%APPDATA%\aiden"
  Remove-AidenPath (Join-Path $localData "aiden")        "%LOCALAPPDATA%\aiden"
  Remove-AidenPath (Join-Path $localData "aiden\cache")  "%LOCALAPPDATA%\aiden\cache"
  Write-Host ""
}

# ── Step 3 — Workspace (conversations, memory, skills, knowledge) ─────────────

if (-not $KeepWorkspace) {
  $workspacePath = Join-Path (Get-Location) "workspace"
  if (Test-Path $workspacePath) {
    Write-Host "${DIM}Found workspace at: $workspacePath${RST}"
    if (-not $Yes) {
      $answer = Read-Host "  Delete workspace? This removes conversations, memory, and skills. [y/N]"
    } else {
      $answer = "y"
    }
    if ($answer -match '^[Yy]') {
      Remove-AidenPath $workspacePath "workspace/"
    } else {
      Write-Host "  ${DIM}kept${RST}     workspace/ (your data is safe)"
    }
    Write-Host ""
  }
}

# ── Step 4 — npm global package ───────────────────────────────────────────────

Write-Host "Checking for npm global install..."
$npmList = npm list -g --depth=0 2>$null
if ($npmList -match "devos-ai|aiden-os|aiden-runtime") {
  Write-Host "  Found npm global package - uninstalling..."
  $pkg = if ($npmList -match "devos-ai") { "devos-ai" } `
         elseif ($npmList -match "aiden-os") { "aiden-os" } `
         else { "aiden-runtime" }
  npm uninstall -g $pkg 2>$null
  Write-Host "  ${GREEN}removed${RST}  npm global: $pkg"
  $removed++
} else {
  Write-Host "  ${DIM}skipped${RST}  no npm global package found"
}
Write-Host ""

# ── Step 5 — Windows startup / scheduled tasks ────────────────────────────────

Write-Host "Checking startup entries..."
$startupTask = Get-ScheduledTask -TaskName "Aiden*" -ErrorAction SilentlyContinue
if ($startupTask) {
  $startupTask | Unregister-ScheduledTask -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "  ${GREEN}removed${RST}  scheduled task: $($startupTask.TaskName)"
  $removed++
} else {
  Write-Host "  ${DIM}skipped${RST}  no scheduled tasks found"
}

$regPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
if (Get-ItemProperty -Path $regPath -Name "Aiden" -ErrorAction SilentlyContinue) {
  Remove-ItemProperty -Path $regPath -Name "Aiden" -ErrorAction SilentlyContinue
  Write-Host "  ${GREEN}removed${RST}  registry startup entry"
  $removed++
}
Write-Host ""

# ── Summary ───────────────────────────────────────────────────────────────────

if ($removed -gt 0) {
  Write-Host ($GREEN + $BOLD + "Done." + $RST + " Aiden uninstalled (" + $removed + " item(s) removed).")
} else {
  Write-Host ($DIM + "Nothing to remove - Aiden does not appear to be installed." + $RST)
}
Write-Host ($DIM + "Project files in " + (Get-Location).Path + " were not touched." + $RST)
Write-Host ""
