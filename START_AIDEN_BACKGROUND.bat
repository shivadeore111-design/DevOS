@echo off
:: ══════════════════════════════════════════════════════════════
::  AIDEN — Silent Background Launcher
::  Starts Aiden as a background service with no blocking window.
::  Use   devos status   to check if running.
::  Use   devos stop     to shut down.
:: ══════════════════════════════════════════════════════════════

cd /d C:\Users\shiva\DevOS

:: Check if already running
npx ts-node index.ts status 2>nul | findstr /C:"is running" >nul
if %errorlevel% == 0 (
  echo Aiden is already running. Use 'devos stop' to stop it.
  exit /b 0
)

:: Start full boot sequence minimized — window will not block terminal
start /min "AIDEN Boot" cmd /c "cd /d C:\Users\shiva\DevOS && START_AIDEN.bat"

:: Brief pause then confirm
timeout /t 6 /nobreak >nul
npx ts-node index.ts status 2>nul
