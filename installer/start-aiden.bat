@echo off
title Aiden — Starting...
cd /d "%~dp0"

:: ── First-run detection ───────────────────────────────────────
set IDENTITY_FILE=%~dp0workspace\identity.json
set ONBOARDING_FILE=%~dp0workspace\onboarding-complete.json

:: Create workspace directories if missing
if not exist "%~dp0workspace" mkdir "%~dp0workspace"
if not exist "%~dp0workspace\sessions" mkdir "%~dp0workspace\sessions"
if not exist "%~dp0workspace\memory" mkdir "%~dp0workspace\memory"
if not exist "%~dp0logs" mkdir "%~dp0logs"

echo.
echo   +==========================================+
echo   ^|  Aiden -- Personal AI OS                ^|
echo   ^|  by Taracod                             ^|
echo   +==========================================+
echo.
echo   Starting Aiden...
echo.

:: Start the API server (port 4200) in background
start /min "Aiden API" cmd /c "npm run start >> logs\aiden.log 2>&1"

:: Start the dashboard (port 3000) in background
start /min "Aiden Dashboard" cmd /c "cd dashboard-next && npm run start >> ..\logs\dashboard.log 2>&1"

:: Wait for servers to initialize
timeout /t 4 /nobreak >nul

:: Determine which page to open
if not exist "%IDENTITY_FILE%" (
  if not exist "%ONBOARDING_FILE%" (
    echo   First run detected — opening onboarding...
    start http://localhost:3000/onboarding
    goto :done
  )
)

:: Normal launch — open main chat
start http://localhost:3000

:done
echo   Aiden is running at http://localhost:3000
echo   API server: http://localhost:4200
echo.
echo   You can close this window.
echo   To stop Aiden, run: taskkill /f /im node.exe
echo.
timeout /t 3 /nobreak >nul
