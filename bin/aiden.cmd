@echo off
:: Aiden launcher — single-word entry point for CMD and PowerShell
:: Installed to %INSTDIR%\resources\bin\ by the NSIS installer.
:: Layout: %INSTDIR%\resources\bin\aiden.cmd  ->  %INSTDIR%\Aiden.exe

setlocal

:: ── Route sub-commands ───────────────────────────────────────────────────────

if "%~1"=="pc" (
  :: Launch Aiden desktop (Electron GUI)
  start "" "%~dp0..\..\Aiden.exe"
  goto :eof
)

if "%~1"=="" goto :help
if "%~1"=="help" goto :help
if "%~1"=="--help" goto :help
if "%~1"=="/?" goto :help

:: ── Unknown sub-command — warn, then pass through to Aiden.exe ───────────────
echo.
echo   Unknown command: %~1
echo   Run "aiden" or "aiden help" to see available commands.
echo.
"%~dp0..\..\Aiden.exe" %*

:: ── Help block ────────────────────────────────────────────────────────────────
:help
echo.
echo   Aiden ^| Local-first Windows AI OS
echo.
echo   Usage:
echo     aiden pc       Launch the desktop app ^(Electron GUI^)
echo     aiden          Show this help message
echo.
echo   Terminal ^(TUI^) interface:
echo     To start the CLI, run the API server first, then launch the TUI:
echo       npm run serve          ^(starts API on port 4200^)
echo       npm run cli            ^(starts the TUI^)
echo     Or from a packaged install, use the Aiden desktop app.
echo.
goto :eof
