# ============================================================
# DevOS — Start SearxNG Search Engine
# ============================================================
# Usage: .\scripts\start-searxng.ps1
# Starts SearxNG via Docker on port 8888
# ============================================================

param(
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Logs
)

$ComposeFile = Join-Path $PSScriptRoot "..\docker-compose.searxng.yml"
$ComposeFile = Resolve-Path $ComposeFile -ErrorAction SilentlyContinue

if (-not $ComposeFile) {
    Write-Host "[SearxNG] ERROR: docker-compose.searxng.yml not found" -ForegroundColor Red
    exit 1
}

# Check Docker is running
try {
    $null = docker version 2>&1
} catch {
    Write-Host "[SearxNG] ERROR: Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

if ($Stop) {
    Write-Host "[SearxNG] Stopping..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile down
    Write-Host "[SearxNG] Stopped." -ForegroundColor Green
    exit 0
}

if ($Logs) {
    docker-compose -f $ComposeFile logs -f
    exit 0
}

if ($Restart) {
    Write-Host "[SearxNG] Restarting..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile down
    Start-Sleep -Seconds 2
}

Write-Host "[SearxNG] Starting SearxNG on http://localhost:8888 ..." -ForegroundColor Cyan
docker-compose -f $ComposeFile up -d

# Wait for SearxNG to be ready
Write-Host "[SearxNG] Waiting for SearxNG to be ready..." -ForegroundColor Yellow
$maxWait = 30
$waited  = 0
$ready   = $false

while ($waited -lt $maxWait) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8888/search?q=test&format=json" `
            -Method GET -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
    $waited += 2
    Write-Host "  ...waiting ($waited/$maxWait s)" -ForegroundColor DarkGray
}

if ($ready) {
    Write-Host "[SearxNG] Ready at http://localhost:8888" -ForegroundColor Green
    Write-Host "[SearxNG] DevOS will now use SearxNG for all web searches." -ForegroundColor Green
    Write-Host ""
    Write-Host "To stop:    .\scripts\start-searxng.ps1 -Stop" -ForegroundColor DarkGray
    Write-Host "To view logs: .\scripts\start-searxng.ps1 -Logs" -ForegroundColor DarkGray
} else {
    Write-Host "[SearxNG] WARNING: SearxNG did not respond in ${maxWait}s. Check Docker logs:" -ForegroundColor Yellow
    Write-Host "  docker-compose -f docker-compose.searxng.yml logs" -ForegroundColor DarkGray
}
