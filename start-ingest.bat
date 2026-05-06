@echo off
title Claudia Ingest Watcher
echo.
echo  ^> Starting Claudia Ingest Watcher...
echo    Polls every 30s for new transcripts and notes.
echo    Requires gateway to be running (start-gateway.bat).
echo.
python D:\Rebirth\ingest_watcher.py
pause
