@echo off
:: Aiden launcher — single-word entry point for CMD and PowerShell
:: Installed to %INSTDIR%\resources\bin\ by the NSIS installer.
:: Aiden.exe lives one directory up in %INSTDIR%\resources\.
"%~dp0..\Aiden.exe" %*
