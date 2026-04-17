<#
.SYNOPSIS
  Aiden installer for Windows.

.DESCRIPTION
  Downloads the latest Aiden release from GitHub, runs the installer
  silently, and verifies the aiden launcher is on PATH.

.EXAMPLE
  iwr https://aiden.taracod.com/install.ps1 -useb | iex
  # — or equivalently —
  Invoke-WebRequest https://aiden.taracod.com/install.ps1 -UseBasicParsing | Invoke-Expression
#>

$ErrorActionPreference = "Stop"

$Repo        = "taracodlabs/aiden-releases"
$TempDir     = "$env:TEMP\aiden-install"

Write-Host ""
Write-Host "  ▲ Aiden Installer" -ForegroundColor DarkYellow
Write-Host "  ---"
Write-Host ""

# ── 1. Fetch latest release metadata ──────────────────────────────────────────
Write-Host "  Fetching latest release..." -ForegroundColor Gray
try {
  $Release = Invoke-RestMethod `
    -Uri "https://api.github.com/repos/$Repo/releases/latest" `
    -UseBasicParsing
  $Version = $Release.tag_name
  $Asset   = $Release.assets |
               Where-Object { $_.name -like "Aiden-Setup-*.exe" } |
               Select-Object -First 1
  if (-not $Asset) {
    throw "No installer asset found in release $Version"
  }
} catch {
  Write-Host "  ✗ Failed to fetch release info: $_" -ForegroundColor Red
  exit 1
}

Write-Host "  Latest version : $Version" -ForegroundColor White
Write-Host "  Installer      : $($Asset.name)  ($([math]::Round($Asset.size / 1MB, 1)) MB)" -ForegroundColor White
Write-Host ""

# ── 2. Prepare temp directory ─────────────────────────────────────────────────
if (-not (Test-Path $TempDir)) {
  New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
}
$InstallerPath = Join-Path $TempDir $Asset.name

# ── 3. Download ───────────────────────────────────────────────────────────────
Write-Host "  Downloading..." -ForegroundColor Gray
$ProgressPreference = 'SilentlyContinue'
try {
  Invoke-WebRequest `
    -Uri $Asset.browser_download_url `
    -OutFile $InstallerPath `
    -UseBasicParsing
} catch {
  Write-Host "  ✗ Download failed: $_" -ForegroundColor Red
  exit 1
}

# Verify file size is at least 95 % of reported size
$ActualSize = (Get-Item $InstallerPath).Length
if ($ActualSize -lt ($Asset.size * 0.95)) {
  Write-Host "  ✗ Downloaded file size mismatch (got $ActualSize, expected $($Asset.size))." -ForegroundColor Red
  exit 1
}
Write-Host "  Download complete." -ForegroundColor Green
Write-Host ""

# ── 4. Run installer silently ─────────────────────────────────────────────────
Write-Host "  Running installer..." -ForegroundColor Gray
Write-Host "  (Note: Windows SmartScreen may show a warning — click 'More info' → 'Run anyway')" -ForegroundColor DarkGray
Write-Host ""

$Process = Start-Process `
  -FilePath $InstallerPath `
  -ArgumentList "/S" `
  -PassThru `
  -Wait

if ($Process.ExitCode -ne 0) {
  Write-Host "  ✗ Installer exited with code $($Process.ExitCode)." -ForegroundColor Red
  exit 1
}

# ── 5. Verify aiden is on PATH ────────────────────────────────────────────────
# Refresh PATH from registry so we see the new entry without reopening terminal
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "User") + ";" +
            [System.Environment]::GetEnvironmentVariable("PATH", "Machine")

$AidenCmd = Get-Command aiden -ErrorAction SilentlyContinue
if ($AidenCmd) {
  Write-Host "  ✓ Aiden installed: $($AidenCmd.Source)" -ForegroundColor Green
  Write-Host ""
  Write-Host "  Open a NEW terminal and type:  aiden" -ForegroundColor DarkYellow
  Write-Host ""
} else {
  Write-Host "  ⚠  Install completed but 'aiden' not yet on PATH." -ForegroundColor Yellow
  Write-Host "     Restart your terminal or log out and back in."
  Write-Host ""
}

# ── 6. Cleanup ────────────────────────────────────────────────────────────────
Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
