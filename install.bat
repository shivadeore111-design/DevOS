@echo off
setlocal enabledelayedexpansion
title Aiden Installer
color 0A
cls

echo.
echo  ================================================
echo   Aiden v2.2 - Your Personal AI OS
echo   by Taracod / White Lotus
echo  ================================================
echo.

REM ── Check Node.js ────────────────────────────────────────────
echo  [1/4] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] Node.js not found.
    echo  Please install Node.js 18+ from: https://nodejs.org
    echo.
    pause
    start https://nodejs.org/en/download/
    exit /b 1
)
for /f "tokens=1" %%v in ('node --version 2^>nul') do set NODE_VER=%%v
echo  [OK] Node.js !NODE_VER! found

REM ── Install node_modules if missing ──────────────────────────
echo.
echo  [2/4] Checking API dependencies...
if not exist "%~dp0node_modules\" (
    echo  Installing... ^(this may take ~1 minute^)
    cd /d "%~dp0"
    npm install --production --silent
    if errorlevel 1 (
        echo  [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo  [OK] API dependencies installed
) else (
    echo  [OK] API dependencies already present
)

REM ── Install dashboard node_modules if missing ─────────────────
echo.
echo  [3/4] Checking dashboard dependencies...
if not exist "%~dp0dashboard-next\node_modules\" (
    echo  Installing... ^(this may take ~1 minute^)
    cd /d "%~dp0dashboard-next"
    npm install --production --silent
    if errorlevel 1 (
        echo  [ERROR] Dashboard npm install failed.
        pause
        exit /b 1
    )
    echo  [OK] Dashboard dependencies installed
) else (
    echo  [OK] Dashboard dependencies already present
)

REM ── Create workspace directories ──────────────────────────────
cd /d "%~dp0"
if not exist "workspace\sandbox"   mkdir "workspace\sandbox"
if not exist "workspace\uploads"   mkdir "workspace\uploads"
if not exist "workspace\artifacts" mkdir "workspace\artifacts"
if not exist "workspace\memory"    mkdir "workspace\memory"
if not exist "logs"                mkdir "logs"

REM ── Create Desktop shortcut ───────────────────────────────────
echo.
echo  [4/4] Creating desktop shortcut...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Aiden.lnk'); $sc.TargetPath = '%~dp0start-aiden.bat'; $sc.WorkingDirectory = '%~dp0'; $sc.Description = 'Aiden - Your Personal AI OS'; $sc.Save()" >nul 2>&1
echo  [OK] Desktop shortcut created

echo.
echo  ================================================
echo   Aiden installed successfully!
echo.
echo   Double-click "Aiden" on your Desktop to start.
echo   Or run start-aiden.bat from this folder.
echo  ================================================
echo.
pause
