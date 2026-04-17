@echo off
:: Aiden launcher — single-word entry point for CMD and PowerShell
:: Installed to %INSTDIR%\resources\bin\ by the NSIS installer.
:: Aiden.exe lives two directories up at %INSTDIR%\Aiden.exe.
:: Layout: %INSTDIR%\resources\bin\aiden.cmd  ->  %INSTDIR%\Aiden.exe
"%~dp0..\..\Aiden.exe" %*
