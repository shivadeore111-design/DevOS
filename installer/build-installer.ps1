# ============================================================
# Build Aiden Windows Installer
# ============================================================
# Prerequisites:
#   1. Inno Setup 6 installed at default location
#      Download: https://jrsoftware.org/isdl.php
#   2. Run: npm run build  (compiles TypeScript -> dist/)
#   3. Run this script from the repo root or installer/ dir
# ============================================================

$ErrorActionPreference = "Stop"

$InnoSetup  = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
$ScriptPath = Join-Path $PSScriptRoot "setup.iss"
$OutputDir  = Join-Path $PSScriptRoot "dist"
$RepoRoot   = Split-Path $PSScriptRoot -Parent

# ── Check Inno Setup ──────────────────────────────────────────
if (-not (Test-Path $InnoSetup)) {
    Write-Host ""
    Write-Host "  Inno Setup 6 not found at:" -ForegroundColor Red
    Write-Host "  $InnoSetup" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Download and install from: https://jrsoftware.org/isdl.php" -ForegroundColor Cyan
    Write-Host "  Then run this script again." -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# ── Check required assets ─────────────────────────────────────
$iconPath  = Join-Path $PSScriptRoot "assets\icon.ico"
$bannerPath = Join-Path $PSScriptRoot "assets\wizard-banner.bmp"
$smallPath  = Join-Path $PSScriptRoot "assets\wizard-icon.bmp"

$missingAssets = @()
if (-not (Test-Path $iconPath))   { $missingAssets += "assets\icon.ico (256x256 ICO)" }
if (-not (Test-Path $bannerPath)) { $missingAssets += "assets\wizard-banner.bmp (497x314 BMP)" }
if (-not (Test-Path $smallPath))  { $missingAssets += "assets\wizard-icon.bmp (55x58 BMP)" }

if ($missingAssets.Count -gt 0) {
    Write-Host ""
    Write-Host "  Missing installer assets:" -ForegroundColor Yellow
    foreach ($a in $missingAssets) {
        Write-Host "    - $a" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "  See installer\assets\icon-spec.md for creation instructions." -ForegroundColor Cyan
    Write-Host "  Using placeholder assets for now (installer will compile but look plain)." -ForegroundColor Gray
    Write-Host ""
}

# ── Build TypeScript first ────────────────────────────────────
Write-Host ""
Write-Host "  [1/3] Building TypeScript..." -ForegroundColor Cyan
Set-Location $RepoRoot
try {
    & npm run build 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    Write-Host "        OK" -ForegroundColor Green
} catch {
    Write-Host "  Build failed: $_" -ForegroundColor Red
    exit 1
}

# ── Create output directory ───────────────────────────────────
Write-Host "  [2/3] Preparing output directory..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Write-Host "        OK  $OutputDir" -ForegroundColor Green

# ── Run Inno Setup ────────────────────────────────────────────
Write-Host "  [3/3] Compiling installer..." -ForegroundColor Cyan
Write-Host ""

& $InnoSetup $ScriptPath /O"$OutputDir" /Q

if ($LASTEXITCODE -eq 0) {
    $exePath = Join-Path $OutputDir "Aiden-Setup.exe"
    $exeSize = if (Test-Path $exePath) {
        $bytes = (Get-Item $exePath).Length
        "$([math]::Round($bytes / 1MB, 1)) MB"
    } else { "unknown size" }

    Write-Host ""
    Write-Host "  +================================================+" -ForegroundColor Green
    Write-Host "  |  SUCCESS: Aiden-Setup.exe ($exeSize)           |" -ForegroundColor Green
    Write-Host "  +================================================+" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Location: $exePath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor Yellow
    Write-Host "    1. Test the installer on a clean Windows machine" -ForegroundColor Yellow
    Write-Host "    2. Create a GitHub Release: v$((Get-Content (Join-Path $RepoRoot 'package.json') | ConvertFrom-Json).version)" -ForegroundColor Yellow
    Write-Host "    3. Upload Aiden-Setup.exe as a release asset" -ForegroundColor Yellow
    Write-Host "    4. Update download URL in cloudflare-worker/landing.js" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "  Build FAILED (exit code $LASTEXITCODE)" -ForegroundColor Red
    Write-Host "  Check the errors above for details." -ForegroundColor Red
    Write-Host ""
    exit $LASTEXITCODE
}
