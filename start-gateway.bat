@echo off
title Claudia Gateway
cd /d "D:\Rebirth\claudia-gateway"

:: Check for nomic-embed-text (needed for RAG / embeddings)
ollama list 2>nul | findstr /i "nomic-embed-text" >nul
if errorlevel 1 (
    echo.
    echo  [!] Pulling nomic-embed-text embedding model for RAG...
    ollama pull nomic-embed-text
    echo  [+] Done!
)

echo.
echo  ^> Starting Claudia Gateway...
echo    Panel UI:    http://localhost:3000/ui/panel
echo    Health:      http://localhost:3000/health
echo    Bifrost:     internal port 8090
echo    Qdrant:      internal port 6333
echo.

claudia.exe serve ^
  --bifrost-bin      "bin\bifrost-http.exe" ^
  --bifrost-config   "config\bifrost.config.json" ^
  --bifrost-data-dir "data\bifrost" ^
  --bifrost-port     8090 ^
  --bifrost-bind     127.0.0.1 ^
  --upstream-host    127.0.0.1 ^
  --qdrant-bin       "bin\qdrant.exe" ^
  --qdrant-storage   "data\qdrant" ^
  --qdrant-bind      127.0.0.1 ^
  --qdrant-http-port 6333 ^
  --config           "config\gateway.yaml"
