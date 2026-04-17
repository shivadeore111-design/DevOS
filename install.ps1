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

# ── ANSI colour helpers ───────────────────────────────────────────────────────
$ESC    = [char]27
$ORANGE = "$ESC[38;2;255;107;53m"
$GREEN  = "$ESC[38;2;34;197;94m"
$RED    = "$ESC[38;2;239;68;68m"
$YELLOW = "$ESC[38;2;251;191;36m"
$DIM    = "$ESC[2m"
$BOLD   = "$ESC[1m"
$RESET  = "$ESC[0m"

# Enable ANSI in PS5.1 (Windows 10 1511+)
if ($PSVersionTable.PSVersion.Major -lt 6) {
  try { [System.Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch {}
  try {
    $null = [System.Runtime.InteropServices.Marshal]::GetDelegateForFunctionPointer(
      (Add-Type -MemberDefinition '[DllImport("kernel32.dll")]public static extern bool SetConsoleMode(IntPtr h,uint m);[DllImport("kernel32.dll")]public static extern bool GetConsoleMode(IntPtr h,out uint m);[DllImport("kernel32.dll")]public static extern IntPtr GetStdHandle(int n);' -Name K32 -PassThru)::GetStdHandle(-11), [Action]
    )
  } catch {}
  try {
    $hOut = [K32]::GetStdHandle(-11); $mode = 0
    if ([K32]::GetConsoleMode($hOut, [ref]$mode)) { [K32]::SetConsoleMode($hOut, $mode -bor 4) | Out-Null }
  } catch {}
}

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ${ORANGE}  ___  ___ ___  ___ _  _${RESET}"
Write-Host "  ${ORANGE} / __|   _|_ _|/ _ | \| |${RESET}"
Write-Host "  ${ORANGE} \__ \ |_  | || (_) | .' |${RESET}"
Write-Host "  ${ORANGE} |___/___|___|\___/|_|\_|${RESET}"
Write-Host ""
Write-Host "  ${DIM}Local-first Windows AI OS${RESET}"
Write-Host "  ${DIM}aiden.taracod.com${RESET}"
Write-Host ""

$Repo    = "taracodlabs/aiden-releases"
$TempDir = "$env:TEMP\aiden-install"

# ── [1/4] Fetch release metadata ──────────────────────────────────────────────
Write-Host "  ${ORANGE}[1/4]${RESET} Fetching latest release..."
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
  Write-Host "  ${RED}[FAIL]${RESET} Could not fetch release info: $_"
  Write-Host ""
  Write-Host "  Check your internet connection and re-run the installer."
  Write-Host "  If behind a corporate proxy, set the HTTP_PROXY environment variable first."
  exit 1
}

$SizeMB = [math]::Round($Asset.size / 1MB, 1)
Write-Host "         Version   : ${BOLD}$Version${RESET}"
Write-Host "         Installer : $($Asset.name)  (${SizeMB} MB)"
Write-Host ""

# ── [2/4] Download ────────────────────────────────────────────────────────────
if (-not (Test-Path $TempDir)) { New-Item -ItemType Directory -Path $TempDir -Force | Out-Null }
$InstallerPath = Join-Path $TempDir $Asset.name

Write-Host "  ${ORANGE}[2/4]${RESET} Downloading $($Asset.name) (${SizeMB} MB)"
$ProgressPreference = 'Continue'
try {
  Write-Progress -Activity "Downloading $($Asset.name)" -Status "0 %" -PercentComplete 0
  Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $InstallerPath -UseBasicParsing
  Write-Progress -Activity "Downloading $($Asset.name)" -Completed
} catch {
  Write-Progress -Activity "Downloading" -Completed
  Write-Host ""
  Write-Host "  ${RED}[FAIL]${RESET} Download failed: $_"
  Write-Host ""
  Write-Host "  This is usually a network interruption. Re-run the installer to retry."
  exit 1
}

$ActualSize = (Get-Item $InstallerPath).Length
if ($ActualSize -lt ($Asset.size * 0.95)) {
  Write-Host "  ${RED}[FAIL]${RESET} Partial download (got $([math]::Round($ActualSize/1MB,1)) MB, expected ${SizeMB} MB)."
  Write-Host ""
  Write-Host "  Usually caused by a network interruption. Re-run the installer."
  exit 1
}
Write-Host "         ${GREEN}Download complete${RESET}  ($([math]::Round($ActualSize/1MB,1)) MB)"
Write-Host ""

# ── SmartScreen callout ───────────────────────────────────────────────────────
Write-Host "  +---------------------------------------------+"
Write-Host "  | IMPORTANT: SmartScreen warning expected     |"
Write-Host "  +---------------------------------------------+"
Write-Host "    If Windows shows ""Windows protected your PC"":"
Write-Host ""
Write-Host "      1. Click ${BOLD}More info${RESET}"
Write-Host "      2. Click ${BOLD}Run anyway${RESET}"
Write-Host ""
Write-Host "    This is normal for newer releases."
Write-Host "    The Aiden installer is code-signed."
Write-Host ""

# ── [3/4] Run installer ───────────────────────────────────────────────────────
Write-Host "  ${ORANGE}[3/4]${RESET} Running installer..."

$Process = Start-Process `
  -FilePath $InstallerPath `
  -ArgumentList "/S" `
  -PassThru `
  -Wait

if ($Process.ExitCode -ne 0) {
  Write-Host ""
  Write-Host "  ${RED}[FAIL]${RESET} Installer exited with code $($Process.ExitCode)."
  Write-Host ""
  Write-Host "  Check the detailed log at: $env:TEMP\aiden-install\install.log"
  exit 1
}
Write-Host "         ${GREEN}Installer finished${RESET}"
Write-Host ""

# ── [4/4] Verify PATH ─────────────────────────────────────────────────────────
Write-Host "  ${ORANGE}[4/4]${RESET} Verifying installation..."

# Refresh PATH from registry so we see the new entry without reopening terminal
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "User") + ";" +
            [System.Environment]::GetEnvironmentVariable("PATH", "Machine")

$AidenCmd    = Get-Command aiden -ErrorAction SilentlyContinue
$InstallPath = "$env:LOCALAPPDATA\Programs\Aiden"

Write-Host ""
Write-Host "  ================================================"
if ($AidenCmd) {
  Write-Host "  ${GREEN}SUCCESS${RESET}  Aiden $Version installed"
  Write-Host ""
  Write-Host "  Location : $InstallPath"
  Write-Host ""
  Write-Host "  Next steps:"
  Write-Host "    1. Open a ${BOLD}NEW terminal${RESET} (PATH changes need a new session)"
  Write-Host "    2. Type:  ${BOLD}aiden${RESET}"
  Write-Host "    3. First-run setup begins automatically"
  Write-Host ""
  Write-Host "  Docs    :  https://aiden.taracod.com"
  Write-Host "  Issues  :  github.com/taracodlabs/aiden-releases/issues"
} else {
  Write-Host "  ${YELLOW}INSTALLED${RESET}  Aiden $Version installed"
  Write-Host ""
  Write-Host "  ${YELLOW}Note:${RESET} 'aiden' is not on PATH in this session yet."
  Write-Host "  This is normal -- open a NEW terminal and type: ${BOLD}aiden${RESET}"
  Write-Host "  If still not found after 30 seconds, log out and back in."
}
Write-Host "  ================================================"
Write-Host ""

# ── Cleanup ───────────────────────────────────────────────────────────────────
Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
