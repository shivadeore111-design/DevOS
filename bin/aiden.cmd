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

if "%~1"=="tui" (
  :: ELECTRON_RUN_AS_NODE=1 makes Electron behave as plain Node.js so
  :: process.stdin is a real TTY — required for readline to work correctly.
  set "ELECTRON_RUN_AS_NODE=1"
  "%~dp0..\..\Aiden.exe" --cli %2 %3 %4 %5 %6 %7 %8 %9
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
echo     aiden tui      Start the terminal ^(CLI^) interface
echo     aiden pc       Launch the desktop app ^(Electron GUI^)
echo     aiden          Show this help message
echo.
goto :eof
