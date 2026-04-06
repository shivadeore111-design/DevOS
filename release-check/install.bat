@echo off
title Aiden Installer
color 0A
echo.
echo  ================================================
echo   Aiden - Your Personal AI OS
echo   by Taracod / White Lotus
echo  ================================================
echo.
echo  Checking requirements...

node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found.
    echo  Please install Node.js 18+ from nodejs.org
    pause
    start https://nodejs.org/en/download/
    exit /b 1
)
echo  [OK] Node.js found

echo.
echo  Installing Aiden...
npm install --production --silent
if errorlevel 1 (
    echo  [ERROR] Installation failed.
    pause
    exit /b 1
)

echo  [OK] Dependencies installed
echo.

REM Create desktop shortcut
echo  Creating desktop shortcut...
powershell -Command " = New-Object -ComObject WScript.Shell;  = .CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Aiden.lnk'); .TargetPath = '%~dp0start-aiden.bat'; .WorkingDirectory = '%~dp0'; .Description = 'Aiden - Your Personal AI OS'; .Save()"

echo  [OK] Desktop shortcut created
echo.
echo  ================================================
echo   Aiden installed successfully!
echo   Double-click Aiden on your Desktop to start.
echo  ================================================
echo.
pause
