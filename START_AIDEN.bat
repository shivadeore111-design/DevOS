@echo off
title Aiden
color 0A
cd /d "%~dp0"
start /min "" ollama serve
timeout /t 3 /nobreak > nul
start /min "Aiden API" cmd /c "cd /d %~dp0 && npx ts-node index.ts serve"
timeout /t 8 /nobreak > nul
start /min "Aiden Dashboard" cmd /c "cd /d %~dp0\dashboard-next && npm run dev"
timeout /t 6 /nobreak > nul
start "" "http://localhost:3000"
echo Aiden is running at http://localhost:3000
echo Close this window to stop Aiden.
pause > nul
taskkill /f /im node.exe > nul 2>&1
taskkill /f /im ollama.exe > nul 2>&1
