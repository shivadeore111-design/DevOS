<#
.SYNOPSIS
  Aiden installer for Windows.

.DESCRIPTION
  Downloads the latest Aiden release from GitHub, runs the installer
  silently, and verifies the aiden launcher is on PATH.

.EXAMPLE
  iwr https://aiden.taracod.com/install.ps1 -useb | iex
  # -- or equivalently --
  Invoke-WebRequest https://aiden.taracod.com/install.ps1 -UseBasicParsing | Invoke-Expression
#>

$ErrorActionPreference = "Stop"

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "    ___  ___ ___  ___ _  _" -ForegroundColor Yellow
Write-Host "   / __|   _|_ _|/ _ | \| |" -ForegroundColor Yellow
Write-Host "   \__ \ |_  | || (_) | .' |" -ForegroundColor Yellow
Write-Host "   |___/___|___|\___/|_|\_|" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Local-first Windows AI OS" -ForegroundColor DarkGray
Write-Host "  aiden.taracod.com" -ForegroundColor DarkGray
Write-Host ""

$Repo    = "taracodlabs/aiden-releases"
$TempDir = "$env:TEMP\aiden-install"

# ── [1/4] Fetch release metadata ──────────────────────────────────────────────
Write-Host "  [1/4] " -ForegroundColor Yellow -NoNewline
Write-Host "Fetching latest release..."
try {
  $Release = Invoke-RestMethod `
    -Uri "https://api.github.com/repos/$Repo/releases/latest" `
    -UseBasicParsing
  $Version = $Release.tag_name
  $Asset   = $Release.assets |
               Where-Object { $_.name -like "Aiden-Setup-*.exe" } |
               Select-Object -First 1
  if (-not $Asset) { throw "No installer asset found in release $Version" }
} catch {
  Write-Host ""
  Write-Host "  [FAIL] Could not fetch release info: $_" -ForegroundColor Red
  Write-Host ""
  Write-Host "  Check your internet connection and re-run the installer."
  Write-Host "  If behind a corporate proxy, set the HTTP_PROXY environment variable first."
  exit 1
}

$SizeMB = [math]::Round($Asset.size / 1MB, 1)
Write-Host "         Version   : $Version"
Write-Host "         Installer : $($Asset.name)  ($SizeMB MB)"
Write-Host ""

# ── [2/4] Download ────────────────────────────────────────────────────────────
if (-not (Test-Path $TempDir)) { New-Item -ItemType Directory -Path $TempDir -Force | Out-Null }
$InstallerPath = Join-Path $TempDir $Asset.name

Write-Host "  [2/4] " -ForegroundColor Yellow -NoNewline
Write-Host "Downloading $($Asset.name) ($SizeMB MB)"
$ProgressPreference = 'Continue'
try {
  Write-Progress -Activity "Downloading $($Asset.name)" -Status "Please wait..." -PercentComplete -1
  Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $InstallerPath -UseBasicParsing
  Write-Progress -Activity "Downloading $($Asset.name)" -Completed
} catch {
  Write-Progress -Activity "Downloading" -Completed
  Write-Host ""
  Write-Host "  [FAIL] Download failed: $_" -ForegroundColor Red
  Write-Host ""
  Write-Host "  This is usually a network interruption. Re-run the installer to retry."
  exit 1
}

$ActualSize = (Get-Item $InstallerPath).Length
if ($ActualSize -lt ($Asset.size * 0.95)) {
  Write-Host "  [FAIL] Partial download (got $([math]::Round($ActualSize/1MB,1)) MB, expected $SizeMB MB)." -ForegroundColor Red
  Write-Host ""
  Write-Host "  Usually caused by a network interruption. Re-run the installer."
  exit 1
}
Write-Host "         Download complete  ($([math]::Round($ActualSize/1MB,1)) MB)" -ForegroundColor Green
Write-Host ""

# ── SmartScreen callout ───────────────────────────────────────────────────────
Write-Host "  +---------------------------------------------+"
Write-Host "  | IMPORTANT: SmartScreen warning expected     |"
Write-Host "  +---------------------------------------------+"
Write-Host "    If Windows shows ""Windows protected your PC"":"
Write-Host ""
Write-Host "      1. Click  More info"
Write-Host "      2. Click  Run anyway"
Write-Host ""
Write-Host "    This is normal for newer releases."
Write-Host "    The Aiden installer is code-signed."
Write-Host ""

# ── [3/4] Run installer ───────────────────────────────────────────────────────
Write-Host "  [3/4] " -ForegroundColor Yellow -NoNewline
Write-Host "Running installer..."

$Process = Start-Process `
  -FilePath $InstallerPath `
  -ArgumentList "/S" `
  -PassThru `
  -Wait

if ($Process.ExitCode -ne 0) {
  Write-Host ""
  Write-Host "  [FAIL] Installer exited with code $($Process.ExitCode)." -ForegroundColor Red
  Write-Host ""
  Write-Host "  Check the detailed log at: $env:TEMP\aiden-install\install.log"
  exit 1
}
Write-Host "         Installer finished" -ForegroundColor Green
Write-Host ""

# ── [4/4] Verify PATH ─────────────────────────────────────────────────────────
Write-Host "  [4/4] " -ForegroundColor Yellow -NoNewline
Write-Host "Verifying installation..."

# Refresh PATH from registry so we see the new entry without reopening terminal
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "User") + ";" +
            [System.Environment]::GetEnvironmentVariable("PATH", "Machine")

$AidenCmd    = Get-Command aiden -ErrorAction SilentlyContinue
$InstallPath = "$env:LOCALAPPDATA\Programs\Aiden"

Write-Host ""
Write-Host "  ================================================"
if ($AidenCmd) {
  Write-Host "  SUCCESS  Aiden $Version installed" -ForegroundColor Green
  Write-Host ""
  Write-Host "  Location : $InstallPath"
  Write-Host ""
  Write-Host "  Next steps:"
  Write-Host "    1. Open a NEW terminal  (PATH changes need a new session)"
  Write-Host "    2. Type:  aiden"
  Write-Host "    3. First-run setup begins automatically"
  Write-Host ""
  Write-Host "  Docs    :  https://aiden.taracod.com"
  Write-Host "  Issues  :  github.com/taracodlabs/aiden-releases/issues"
} else {
  Write-Host "  INSTALLED  Aiden $Version installed" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  Note: 'aiden' is not on PATH in this session yet." -ForegroundColor Yellow
  Write-Host "  This is normal -- open a NEW terminal and type: aiden"
  Write-Host "  If still not found after 30 seconds, log out and back in."
}
Write-Host "  ================================================"
Write-Host ""

# ── Cleanup ───────────────────────────────────────────────────────────────────
Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
