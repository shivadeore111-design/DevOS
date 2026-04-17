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
  :: Launch Aiden terminal UI (CLI) in the current terminal window
  :: In the installed build: use the bundled CLI script from resources\dist
  :: In dev: fall back to ts-node
  set "CLI_BUNDLE=%~dp0..\dist\cli.js"
  set "NODE_PATH_DIR=%~dp0..\node_modules"
  if exist "%CLI_BUNDLE%" (
    node --enable-source-maps "%CLI_BUNDLE%"
  ) else (
    :: Dev fallback — run from source via ts-node
    where ts-node >nul 2>&1
    if not errorlevel 1 (
      ts-node "%~dp0..\..\cli\aiden.ts"
    ) else (
      echo.
      echo   [Aiden] TUI requires the Aiden desktop app to be running.
      echo.
      echo   Try:  aiden pc    to launch the desktop app first,
      echo   then: aiden tui   to open the terminal interface.
      echo.
    )
  )
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
