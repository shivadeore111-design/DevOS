# Aiden -- Personal AI OS Installer
# Run as Administrator: Right-click install.ps1 -> Run with PowerShell

Write-Host ""
Write-Host "  +==========================================+" -ForegroundColor Cyan
Write-Host "  |  Aiden -- Personal AI OS                |" -ForegroundColor Cyan
Write-Host "  |  by Taracod                             |" -ForegroundColor Cyan
Write-Host "  +==========================================+" -ForegroundColor Cyan
Write-Host ""

$DEVOS_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$errors = @()

Write-Host "  [1/4] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    if ($nodeVersion -match "v(\d+)" -and [int]$Matches[1] -ge 18) {
        Write-Host "        OK  Node.js $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "        Node.js v18+ required -- get it at nodejs.org" -ForegroundColor Red
        $errors += "Node.js v18+ required"
    }
} catch {
    Write-Host "        Node.js not found -- download from nodejs.org" -ForegroundColor Red
    $errors += "Node.js not installed"
}

Write-Host "  [2/4] Checking Ollama (optional)..." -ForegroundColor Yellow
try {
    ollama --version 2>&1 | Out-Null
    Write-Host "        OK  Ollama found" -ForegroundColor Green
} catch {
    Write-Host "        Ollama not found -- Aiden will use cloud providers" -ForegroundColor Yellow
    Write-Host "        Install later from ollama.com for fully local mode" -ForegroundColor Gray
}

Write-Host "  [3/4] Installing dependencies..." -ForegroundColor Yellow
try {
    Set-Location $DEVOS_DIR
    npm install --silent 2>&1 | Out-Null
    Set-Location "$DEVOS_DIR\dashboard-next"
    npm install --silent 2>&1 | Out-Null
    Set-Location $DEVOS_DIR
    Write-Host "        OK  Dependencies ready" -ForegroundColor Green
} catch {
    Write-Host "        Install failed -- check your internet connection" -ForegroundColor Red
    $errors += "npm install failed"
}

Write-Host "  [4/4] Creating desktop shortcut..." -ForegroundColor Yellow
try {
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Aiden.lnk")
    $Shortcut.TargetPath = "$DEVOS_DIR\START_AIDEN.bat"
    $Shortcut.WorkingDirectory = $DEVOS_DIR
    $Shortcut.Description = "Start Aiden"
    $Shortcut.Save()
    Write-Host "        OK  Shortcut on Desktop" -ForegroundColor Green
} catch {
    Write-Host "        Could not create shortcut" -ForegroundColor Yellow
}

Write-Host ""
if ($errors.Count -eq 0) {
    Write-Host "  +==========================================+" -ForegroundColor Green
    Write-Host "  |  Ready. Double-click Aiden on Desktop   |" -ForegroundColor Green
    Write-Host "  +==========================================+" -ForegroundColor Green
} else {
    $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host "  Fix the above then run install.ps1 again" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
