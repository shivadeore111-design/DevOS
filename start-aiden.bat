@echo off
setlocal
title Aiden
color 0A
cd /d "%~dp0"

REM ── Ensure log directory exists ───────────────────────────────
if not exist "logs" mkdir "logs"

REM ── Ensure workspace dirs exist ───────────────────────────────
if not exist "workspace\sandbox"   mkdir "workspace\sandbox"
if not exist "workspace\uploads"   mkdir "workspace\uploads"
if not exist "workspace\artifacts" mkdir "workspace\artifacts"
if not exist "workspace\memory"    mkdir "workspace\memory"

REM ── Start API server (port 4200) ─────────────────────────────
echo  Starting Aiden API...
start /min "Aiden API" cmd /c "cd /d "%~dp0" && node dist/index.js serve > logs\api.log 2>&1"

REM ── Wait for API to be ready ─────────────────────────────────
timeout /t 4 /nobreak >nul

REM ── Start dashboard (port 3000) ──────────────────────────────
echo  Starting Aiden Dashboard...
start /min "Aiden Dashboard" cmd /c "cd /d "%~dp0dashboard-next" && node_modules\.bin\next start -p 3000 > ..\logs\dashboard.log 2>&1"

REM ── Wait for dashboard to be ready ───────────────────────────
timeout /t 5 /nobreak >nul

REM ── First-run detection: open onboarding if fresh install ─────
set IDENTITY_FILE=%~dp0workspace\identity.json
set ONBOARDING_FILE=%~dp0workspace\onboarding-complete.json

if not exist "%IDENTITY_FILE%" (
    if not exist "%ONBOARDING_FILE%" (
        echo  First run detected - opening onboarding...
        start http://localhost:3000/onboarding
        goto :done
    )
)

REM ── Normal start: open dashboard ─────────────────────────────
start http://localhost:3000

:done
echo.
echo  Aiden is running at http://localhost:3000
echo  API server is on http://localhost:4200
echo.
echo  Logs: %~dp0logs\
echo  Close this window to stop Aiden (or close the API/Dashboard windows).
echo.
