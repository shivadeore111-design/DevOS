<#
.SYNOPSIS
  Downloads the latest Aiden installer and prints its SHA256 hash.

.DESCRIPTION
  Fetches the latest release from GitHub, downloads the Aiden-Setup-*.exe asset
  to a temp file, computes SHA256, and prints it ready to paste into
  Taracod.Aiden.installer.yaml.

.EXAMPLE
  .\generate-sha256.ps1
#>

$ErrorActionPreference = "Stop"
$Repo    = "taracodlabs/aiden-releases"
$TempDir = "$env:TEMP\aiden-sha256"

Write-Host ""
Write-Host "  Fetching latest release from $Repo ..." -ForegroundColor Gray

$Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -UseBasicParsing
$Version = $Release.tag_name
$Asset   = $Release.assets | Where-Object { $_.name -like "Aiden-Setup-*.exe" } | Select-Object -First 1

if (-not $Asset) { Write-Host "  No installer asset found in $Version" -ForegroundColor Red; exit 1 }

Write-Host "  Version   : $Version" -ForegroundColor White
Write-Host "  Asset     : $($Asset.name)" -ForegroundColor White
Write-Host "  Downloading..." -ForegroundColor Gray

if (-not (Test-Path $TempDir)) { New-Item -ItemType Directory -Path $TempDir -Force | Out-Null }
$OutFile = Join-Path $TempDir $Asset.name

$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $OutFile -UseBasicParsing

$Hash = (Get-FileHash -Algorithm SHA256 -Path $OutFile).Hash
Write-Host ""
Write-Host "  SHA256: $Hash" -ForegroundColor Green
Write-Host ""
Write-Host "  Paste the value above into Taracod.Aiden.installer.yaml → InstallerSha256" -ForegroundColor DarkYellow

Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
