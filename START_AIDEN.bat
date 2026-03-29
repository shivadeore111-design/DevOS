@echo off
chcp 65001 >nul
title Aiden — Personal AI OS
color 0A

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║  Aiden — Your Personal AI OS            ║
echo  ║  Starting up...                         ║
echo  ╚══════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Clear ports before starting
echo  Clearing ports 4200 + 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4200 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 2^>nul') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul

:: Start Ollama in background
echo  [1/3] Starting Ollama...
start /min "" ollama serve
timeout /t 3 /nobreak >nul

:: Start DevOS API server
echo  [2/3] Starting Aiden API...
start /min "Aiden API" cmd /c "cd /d %~dp0 && npx ts-node index.ts serve 2>>workspace\aiden-error.log"
timeout /t 8 /nobreak >nul

:: Start Dashboard
echo  [3/3] Starting Dashboard...
start /min "Aiden Dashboard" cmd /c "cd /d %~dp0\dashboard-next && npm run dev"
timeout /t 6 /nobreak >nul

:: Open browser
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║  STATUS    ONLINE                       ║
echo  ║  API       http://localhost:4200         ║
echo  ║  Dashboard http://localhost:3000         ║
echo  ║  Ollama    http://localhost:11434        ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Aiden is running at http://localhost:3000
echo.
start "" "http://localhost:3000"

echo  Press any key to stop Aiden...
pause >nul

:: Shutdown
cls
color 0C
echo.
echo  Stopping Aiden...
echo.
taskkill /F /FI "WindowTitle eq Aiden API" >nul 2>&1
taskkill /F /FI "WindowTitle eq Aiden Dashboard" >nul 2>&1
taskkill /F /IM "ollama.exe" >nul 2>&1
timeout /t 1 /nobreak >nul
color 07
echo  All systems offline.
echo  Aiden will be here when you get back.
echo.
timeout /t 3 /nobreak >nul
