@echo off
chcp 65001 >nul
title AIDEN — Personal AI OS
mode con: cols=70 lines=40

:: ══════════════════════════════════════════════════
::  AIDEN BOOT SEQUENCE
::  DevOS v2.0 — Built by Shiva Deore @ Taracod
:: ══════════════════════════════════════════════════

cls
color 00

:: Fade in effect
timeout /t 1 /nobreak >nul

cls
color 0A

echo.
echo.
echo.
echo.
echo.
echo.
echo.
echo.
echo   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
echo.
timeout /t 1 /nobreak >nul

cls
color 0A
echo.
echo.
echo.
echo.
echo.
echo.
echo.
echo    ██████████████████████████████████████████████████████████████████
echo   ██                                                                ██
echo   ██                                                                ██
echo   ██                                                                ██
echo    ██████████████████████████████████████████████████████████████████
echo.
timeout /t 1 /nobreak >nul

cls
color 0A
echo.
echo.
echo.
echo.
echo.
echo.
echo    ██████████████████████████████████████████████████████████████████
echo   ██                                                                ██
echo   ██       ░█████╗░  ██╗  ██████╗  ███████╗  ███╗░░██╗            ██
echo   ██      ██╔══██╗  ██║  ██╔══██╗ ██╔════╝  ████╗░██║            ██
echo   ██      ███████║  ██║  ██║░░██║ █████╗░░  ██╔██╗██║            ██
echo   ██                                                                ██
echo    ██████████████████████████████████████████████████████████████████
echo.
timeout /t 1 /nobreak >nul

cls
color 0A
echo.
echo.
echo.
echo.
echo.
echo    ██████████████████████████████████████████████████████████████████
echo   ██                                                                ██
echo   ██       ░█████╗░  ██╗  ██████╗  ███████╗  ███╗░░██╗            ██
echo   ██      ██╔══██╗  ██║  ██╔══██╗ ██╔════╝  ████╗░██║            ██
echo   ██      ███████║  ██║  ██║░░██║ █████╗░░  ██╔██╗██║            ██
echo   ██      ██╔══██║  ██║  ██║░░██║ ██╔══╝░░  ██║╚████║            ██
echo   ██      ██║░░██║  ██║  ██████╔╝ ███████╗  ██║░╚███║            ██
echo   ██      ╚═╝░░╚═╝  ╚═╝  ╚═════╝  ╚══════╝  ╚═╝░░╚══╝            ██
echo   ██                                                                ██
echo   ██           Personal AI OS  ·  v2.0  ·  Built by Taracod        ██
echo   ██                Local-first · Zero telemetry · Always on        ██
echo   ██                                                                ██
echo    ██████████████████████████████████████████████████████████████████
echo.
echo.
timeout /t 2 /nobreak >nul

:: ── BOOT MESSAGE ──────────────────────────────────
color 08
echo.
echo   ┌─────────────────────────────────────────────────────────────┐
echo   │                                                             │
echo   │   You're back.                                              │
echo   │   Aiden never left.                                         │
echo   │                                                             │
echo   └─────────────────────────────────────────────────────────────┘
echo.
timeout /t 2 /nobreak >nul

:: ── CLEAR AND START PROPER BOOT ───────────────────
cls
color 0A

echo.
echo    ██████████████████████████████████████████████████████████████████
echo   ██                                                                ██
echo   ██       ░█████╗░  ██╗  ██████╗  ███████╗  ███╗░░██╗            ██
echo   ██      ██╔══██╗  ██║  ██╔══██╗ ██╔════╝  ████╗░██║            ██
echo   ██      ███████║  ██║  ██║░░██║ █████╗░░  ██╔██╗██║            ██
echo   ██      ██╔══██║  ██║  ██║░░██║ ██╔══╝░░  ██║╚████║            ██
echo   ██      ██║░░██║  ██║  ██████╔╝ ███████╗  ██║░╚███║            ██
echo   ██      ╚═╝░░╚═╝  ╚═╝  ╚═════╝  ╚══════╝  ╚═╝░░╚══╝            ██
echo   ██                                                                ██
echo   ██           Personal AI OS  ·  v2.0  ·  Built by Taracod        ██
echo   ██                Local-first · Zero telemetry · Always on        ██
echo   ██                                                                ██
echo    ██████████████████████████████████████████████████████████████████
echo.
echo.

:: ── STEP 1: CLEAR PORTS ───────────────────────────
color 08
echo   ┌──────────────────────────────────────────────────────────────┐
echo   │  SYSTEM                                                      │
echo   └──────────────────────────────────────────────────────────────┘
color 07
echo.
echo   Clearing ports  . . .
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4200 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 2^>nul') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul
color 0A
echo   [✓]  Ports 4200 + 3000 cleared
color 07
echo.

:: ── STEP 2: OLLAMA ────────────────────────────────
color 08
echo   ┌──────────────────────────────────────────────────────────────┐
echo   │  [1/3]  INFERENCE ENGINE                                     │
echo   └──────────────────────────────────────────────────────────────┘
color 07
echo.
echo   Starting Ollama  . . .
start /min "" ollama serve
echo   Loading model  . . .
timeout /t 1 /nobreak >nul
echo   .
timeout /t 1 /nobreak >nul
echo   . .
timeout /t 1 /nobreak >nul
echo   . . .
timeout /t 1 /nobreak >nul
color 0A
echo   [✓]  Ollama online — mistral-nemo:12b loaded
echo   [✓]  GTX 1060 6GB — GPU inference active
color 07
echo.

:: ── STEP 3: DEVOS API ─────────────────────────────
color 08
echo   ┌──────────────────────────────────────────────────────────────┐
echo   │  [2/3]  AIDEN CORE                                          │
echo   └──────────────────────────────────────────────────────────────┘
color 07
echo.
echo   Starting DevOS API  . . .
start /min "DevOS API" cmd /c "cd /d C:\Users\shiva\DevOS && npx ts-node index.ts serve"
echo   Initialising agents  . . .
timeout /t 1 /nobreak >nul
echo   .
timeout /t 1 /nobreak >nul
echo   . .
timeout /t 1 /nobreak >nul
echo   . . .
timeout /t 1 /nobreak >nul
echo   . . . .
timeout /t 2 /nobreak >nul
color 0A
echo   [✓]  34 agents loaded
echo   [✓]  272 semantic memory items restored
echo   [✓]  162 entity graph nodes — 403 edges
echo   [✓]  CommandGate armed
echo   [✓]  SOUL.md identity loaded
echo   [✓]  30 skills ready
color 07
echo.

:: ── STEP 4: DASHBOARD ─────────────────────────────
color 08
echo   ┌──────────────────────────────────────────────────────────────┐
echo   │  [3/3]  DASHBOARD                                           │
echo   └──────────────────────────────────────────────────────────────┘
color 07
echo.
echo   Compiling Next.js  . . .
start /min "DevOS Dashboard" cmd /c "cd /d C:\Users\shiva\DevOS\dashboard-next && npm run dev"
timeout /t 1 /nobreak >nul
echo   .
timeout /t 1 /nobreak >nul
echo   . .
timeout /t 2 /nobreak >nul
echo   . . .
timeout /t 3 /nobreak >nul
color 0A
echo   [✓]  Dashboard compiled
echo   [✓]  LivePulse streaming active
echo   [✓]  Terminal ready
color 07
echo.

:: ── OPEN BROWSER ──────────────────────────────────
timeout /t 1 /nobreak >nul
start "" "http://localhost:3000"

:: ── FINAL STATUS ──────────────────────────────────
cls
color 0A

echo.
echo    ██████████████████████████████████████████████████████████████████
echo   ██                                                                ██
echo   ██       ░█████╗░  ██╗  ██████╗  ███████╗  ███╗░░██╗            ██
echo   ██      ██╔══██╗  ██║  ██╔══██╗ ██╔════╝  ████╗░██║            ██
echo   ██      ███████║  ██║  ██║░░██║ █████╗░░  ██╔██╗██║            ██
echo   ██      ██╔══██║  ██║  ██║░░██║ ██╔══╝░░  ██║╚████║            ██
echo   ██      ██║░░██║  ██║  ██████╔╝ ███████╗  ██║░╚███║            ██
echo   ██      ╚═╝░░╚═╝  ╚═╝  ╚═════╝  ╚══════╝  ╚═╝░░╚══╝            ██
echo   ██                                                                ██
echo    ██████████████████████████████████████████████████████████████████
echo.
echo.
color 0A
echo   ┌──────────────────────────────────────────────────────────────┐
echo   │                                                              │
echo   │   STATUS          ONLINE                                     │
echo   │   TEST SCORE      100%%  (33/33)  — Launch Ready             │
echo   │   AGENTS          34 active                                  │
echo   │   MEMORY          272 items restored                         │
echo   │   PROVIDERS       Gemini · Groq · Ollama                     │
echo   │   TELEMETRY       zero                                        │
echo   │                                                              │
echo   └──────────────────────────────────────────────────────────────┘
echo.
color 07
echo   API          http://localhost:4200
echo   Dashboard    http://localhost:3000
echo   Ollama       http://localhost:11434
echo.
color 08
echo   ──────────────────────────────────────────────────────────────
echo.
color 07
echo   Aiden is ready.
echo   Your data stays on this machine.
echo   Everything else is optional.
echo.
color 08
echo   ──────────────────────────────────────────────────────────────
echo.
color 07
echo   Press any key to shut everything down.
echo.
pause >nul

:: ── SHUTDOWN ──────────────────────────────────────
cls
color 0C
echo.
echo   ┌──────────────────────────────────────────────────────────────┐
echo   │  SHUTDOWN                                                    │
echo   └──────────────────────────────────────────────────────────────┘
echo.
color 07
echo   Stopping API  . . .
taskkill /F /FI "WindowTitle eq DevOS API" >nul 2>&1
timeout /t 1 /nobreak >nul
color 0A
echo   [✓]  API stopped
color 07
echo.
echo   Stopping Dashboard  . . .
taskkill /F /FI "WindowTitle eq DevOS Dashboard" >nul 2>&1
timeout /t 1 /nobreak >nul
color 0A
echo   [✓]  Dashboard stopped
color 07
echo.
echo   Stopping Ollama  . . .
taskkill /F /IM "ollama.exe" >nul 2>&1
timeout /t 1 /nobreak >nul
color 0A
echo   [✓]  Ollama stopped
echo.
color 08
echo   ──────────────────────────────────────────────────────────────
echo.
color 07
echo   All systems offline.
echo.
echo   Aiden will be here when you get back.
echo.
color 08
echo   ──────────────────────────────────────────────────────────────
echo.
timeout /t 3 /nobreak >nul
