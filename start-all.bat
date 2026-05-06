@echo off
title Claudia — Start All
echo.
echo  ✦ Starting Claudia stack...
echo.
echo  Terminal 1: Receiver       (transcription, port 8765)
echo  Terminal 2: Gateway        (AI router + RAG, port 3000)
echo  Terminal 3: Ingest         (watches transcripts + notes)
echo  Terminal 4: PWA Server     (legacy tabbed app, port 8080)
echo  Terminal 5: Orchestrator   (original PWA + conversations, port 11435 HTTPS)
echo.

:: Receiver — uses py -3.14 so it picks up the env with torch+CUDA
start "Claudia Receiver" cmd /k py -3.14 "D:\Rebirth\Moto X\receiver.py"

:: Small delay so receiver loads first (Whisper model takes a moment)
timeout /t 3 /nobreak >nul

:: Gateway (includes Qdrant + Bifrost)
start "Claudia Gateway" cmd /k "D:\Rebirth\start-gateway.bat"

:: Ingest watcher (starts polling once gateway is up)
start "Claudia Ingest" cmd /k "py -3.14 D:\Rebirth\ingest_watcher.py"

:: PWA server (legacy tabbed app + transcripts/files/notes APIs on :8080)
start "Claudia PWA" cmd /k "py -3.14 D:\Rebirth\pwa\server.py"

:: Mobile orchestrator (original PWA at /web + conversations + auth on :11435 HTTPS)
:: Must run from inside Previously Claudia Core so its imports + paths_config resolve
start "Claudia Orchestrator" cmd /k "cd /d \"D:\Rebirth\Previously Claudia Core\" && py -3.14 Scripts\mobile_orchestrator_api.py"

echo.
echo  All services started in separate windows.
echo.
echo  Original PWA (with sidebar/conversations):  https://localhost:11435/web
echo  Legacy tabbed app:                          http://localhost:8080/legacy-app
echo  iPhone: use Tailscale IP shown in PWA window.
echo.
echo  Note: Original PWA uses HTTPS with self-signed cert — your browser will warn,
echo        click "Advanced -^> Proceed" once and it'll remember.
echo.
pause
