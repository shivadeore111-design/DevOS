# DevOS / Aiden — One-Click Windows Installer
# Run as Administrator: Right-click -> Run with PowerShell

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Aiden — Personal AI OS Installer       ║" -ForegroundColor Cyan
Write-Host "║  by Taracod / White Lotus               ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$DEVOS_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$errors = @()

# Step 1 — Check Node.js
Write-Host "[ 1/6 ] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    if ($nodeVersion -match "v(\d+)") {
        $major = [int]$Matches[1]
        if ($major -lt 18) {
            Write-Host "        Node.js $nodeVersion found but v18+ required" -ForegroundColor Red
            Write-Host "        Download: https://nodejs.org" -ForegroundColor Gray
            $errors += "Node.js v18+ required"
        } else {
            Write-Host "        OK Node.js $nodeVersion" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "        X Node.js not found — download from https://nodejs.org" -ForegroundColor Red
    $errors += "Node.js not installed"
}

# Step 2 — Check/Install Ollama
Write-Host "[ 2/6 ] Checking Ollama..." -ForegroundColor Yellow
try {
    $ollamaVersion = ollama --version 2>&1
    Write-Host "        OK Ollama found ($ollamaVersion)" -ForegroundColor Green
} catch {
    Write-Host "        Ollama not found — downloading installer..." -ForegroundColor Yellow
    $ollamaInstaller = "$env:TEMP\ollama-installer.exe"
    try {
        Invoke-WebRequest -Uri "https://ollama.com/download/windows" -OutFile $ollamaInstaller -UseBasicParsing
        Start-Process $ollamaInstaller -Wait
        Write-Host "        OK Ollama installed" -ForegroundColor Green
    } catch {
        Write-Host "        X Could not auto-install Ollama — download from https://ollama.com" -ForegroundColor Red
        $errors += "Ollama not installed"
    }
}

# Step 3 — Install npm dependencies
Write-Host "[ 3/6 ] Installing dependencies..." -ForegroundColor Yellow
try {
    Set-Location $DEVOS_DIR
    npm install --silent 2>&1 | Out-Null
    Write-Host "        OK Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "        X npm install failed" -ForegroundColor Red
    $errors += "npm install failed"
}

# Step 4 — Install dashboard dependencies
Write-Host "[ 4/6 ] Installing dashboard dependencies..." -ForegroundColor Yellow
try {
    Set-Location "$DEVOS_DIR\dashboard-next"
    npm install --silent 2>&1 | Out-Null
    Write-Host "        OK Dashboard dependencies installed" -ForegroundColor Green
    Set-Location $DEVOS_DIR
} catch {
    Write-Host "        X Dashboard npm install failed" -ForegroundColor Red
    $errors += "Dashboard npm install failed"
}

# Step 5 — Pull default Ollama model
Write-Host "[ 5/6 ] Pulling default AI model (mistral-nemo:12b)..." -ForegroundColor Yellow
Write-Host "        This may take a few minutes on first run..." -ForegroundColor Gray
try {
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    ollama pull mistral-nemo:12b 2>&1 | Out-Null
    Write-Host "        OK Model ready" -ForegroundColor Green
} catch {
    Write-Host "        ! Could not pull model — Aiden will use cloud providers" -ForegroundColor Yellow
}

# Step 6 — Create desktop shortcut
Write-Host "[ 6/6 ] Creating desktop shortcut..." -ForegroundColor Yellow
try {
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Aiden.lnk")
    $Shortcut.TargetPath = "$DEVOS_DIR\START_AIDEN.bat"
    $Shortcut.WorkingDirectory = $DEVOS_DIR
    $Shortcut.Description = "Start Aiden — Personal AI OS"
    $Shortcut.Save()
    Write-Host "        OK Shortcut created on Desktop" -ForegroundColor Green
} catch {
    Write-Host "        ! Could not create shortcut" -ForegroundColor Yellow
}

Write-Host ""
if ($errors.Count -eq 0) {
    Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  Aiden is ready!                        ║" -ForegroundColor Green
    Write-Host "║  Double-click Aiden on your Desktop     ║" -ForegroundColor Green
    Write-Host "║  or run START_AIDEN.bat                 ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
} else {
    Write-Host "Installation completed with errors:" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host "Fix the above and run install.ps1 again" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
