@echo off
title Aiden
cd /d "%~dp0"
start /min cmd /c "npm run start > logs\aiden.log 2>&1"
timeout /t 3 /nobreak >nul
start http://localhost:3000
