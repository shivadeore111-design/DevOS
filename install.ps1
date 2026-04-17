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
Write-Host "     █████╗ ██╗██████╗ ███████╗███╗   ██╗" -ForegroundColor Yellow
Write-Host "    ██╔══██╗██║██╔══██╗██╔════╝████╗  ██║" -ForegroundColor Yellow
Write-Host "    ███████║██║██║  ██║█████╗  ██╔██╗ ██║" -ForegroundColor Yellow
Write-Host "    ██╔══██║██║██║  ██║██╔══╝  ██║╚██╗██║" -ForegroundColor Yellow
Write-Host "    ██║  ██║██║██████╔╝███████╗██║ ╚████║" -ForegroundColor Yellow
Write-Host "    ╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝" -ForegroundColor Yellow
Write-Host ""
Write-Host "    Local-first Windows AI OS" -ForegroundColor DarkGray
Write-Host "    aiden.taracod.com" -ForegroundColor DarkGray
Write-Host ""

$Repo       = "taracodlabs/aiden-releases"
$TempDir    = "$env:TEMP\aiden-install"
$InstallDir = "$env:LOCALAPPDATA\Programs\Aiden"

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

# ── [3/4] Run installer with spinner ─────────────────────────────────────────
Write-Host "  [3/4] " -ForegroundColor Yellow -NoNewline
Write-Host "Installing (this takes 30-60 seconds)..." -NoNewline

$proc = Start-Process -FilePath $InstallerPath -ArgumentList "/S" -PassThru
$spin = @('|', '/', '-', '\')
$i    = 0
while (-not $proc.HasExited) {
  Write-Host "`r  [3/4] " -ForegroundColor Yellow -NoNewline
  Write-Host "Installing... $($spin[$i % 4])  " -NoNewline
  Start-Sleep -Milliseconds 200
  $i++
}
Write-Host "`r  [3/4] " -ForegroundColor Yellow -NoNewline
Write-Host "Installed                         "

if ($proc.ExitCode -ne 0) {
  Write-Host ""
  Write-Host "  [FAIL] Installer exited with code $($proc.ExitCode)." -ForegroundColor Red
  Write-Host ""
  Write-Host "  Check the detailed log at: $env:TEMP\aiden-install\install.log"
  exit 1
}
Write-Host ""

# ── [4/4] Verify PATH ─────────────────────────────────────────────────────────
Write-Host "  [4/4] " -ForegroundColor Yellow -NoNewline
Write-Host "Verifying installation..."

$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "User") + ";" +
            [System.Environment]::GetEnvironmentVariable("PATH", "Machine")

$AidenCmd = Get-Command aiden -ErrorAction SilentlyContinue

Write-Host ""
if ($AidenCmd) {
  Write-Host "  ================================================" -ForegroundColor Green
  Write-Host "  SUCCESS  " -ForegroundColor Green -NoNewline
  Write-Host "Aiden $Version installed"
  Write-Host "  ================================================" -ForegroundColor Green
  Write-Host ""
  Write-Host "    Location: $InstallDir"
  Write-Host ""
  Write-Host "  How would you like to start Aiden?" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "    [1] " -ForegroundColor Yellow -NoNewline
  Write-Host "Desktop app  (Electron UI with dashboard)"
  Write-Host "    [2] " -ForegroundColor Yellow -NoNewline
  Write-Host "Terminal     (CLI right here in this terminal)"
  Write-Host "    [3] " -ForegroundColor Yellow -NoNewline
  Write-Host "Later        (I'll start it myself)"
  Write-Host ""
  $choice = Read-Host "  Enter choice (1/2/3)"

  switch ($choice) {
    '1' {
      Write-Host ""
      Write-Host "  Launching Aiden desktop..." -ForegroundColor Green
      $exePath = Join-Path $InstallDir "Aiden.exe"
      if (Test-Path $exePath) {
        Start-Process $exePath
      } else {
        Write-Host "  Could not find Aiden.exe at $exePath" -ForegroundColor Red
        Write-Host "  Try launching from the Start Menu." -ForegroundColor DarkGray
      }
    }
    '2' {
      Write-Host ""
      Write-Host "  Starting Aiden terminal..." -ForegroundColor Green
      $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","User") + ";" +
                  [System.Environment]::GetEnvironmentVariable("PATH","Machine")
      $aidenExe = Get-Command aiden -ErrorAction SilentlyContinue
      if ($aidenExe) {
        & aiden
      } else {
        Write-Host "  'aiden' not found on PATH yet." -ForegroundColor Red
        Write-Host "  Open a NEW terminal and type: aiden" -ForegroundColor DarkGray
      }
    }
    default {
      Write-Host ""
      Write-Host "  Ready when you are." -ForegroundColor DarkGray
      Write-Host "  Open a new terminal and type: " -NoNewline
      Write-Host "aiden" -ForegroundColor Yellow
      Write-Host ""
      Write-Host "  Docs:   https://aiden.taracod.com" -ForegroundColor DarkGray
      Write-Host "  Issues: github.com/taracodlabs/aiden-releases/issues" -ForegroundColor DarkGray
      Write-Host ""
    }
  }
} else {
  Write-Host "  ================================================"
  Write-Host "  INSTALLED  " -ForegroundColor Yellow -NoNewline
  Write-Host "Aiden $Version installed"
  Write-Host "  ================================================"
  Write-Host ""
  Write-Host "  Note: 'aiden' is not on PATH in this session yet." -ForegroundColor Yellow
  Write-Host "  This is normal -- open a NEW terminal and type: aiden"
  Write-Host "  If still not found after 30 seconds, log out and back in."
  Write-Host ""
}

# ── Cleanup ───────────────────────────────────────────────────────────────────
Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
