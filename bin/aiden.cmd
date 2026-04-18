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
  :: Use Aiden.exe --cli — Electron's bundled Node runs the CLI bundle.
  :: No system Node.js required: ELECTRON_RUN_AS_NODE=1 is set inside main.js.
  "%~dp0..\..\Aiden.exe" --cli %2 %3 %4 %5 %6 %7 %8 %9
  goto :eof
)

if "%~1"=="" (
  :: No arguments — print help
  echo.
  echo   Aiden ^| Local-first Windows AI OS
  echo.
  echo   Usage:
  echo     aiden tui      Start the terminal ^(CLI^) interface
  echo     aiden pc       Launch the desktop app ^(Electron GUI^)
  echo     aiden          Show this help message
  echo.
  goto :eof
)

:: ── Unknown sub-command — pass everything through to Aiden.exe ───────────────
"%~dp0..\..\Aiden.exe" %*
