@echo off
cd /d "%~dp0"

set "NODE_EXE=node"
where node >nul 2>nul
if errorlevel 1 set "NODE_EXE=C:\Program Files\nodejs\node.exe"

echo.
echo Starting ARTEKO price list server...
echo Open in your browser: http://localhost:4173
echo To stop: close this window.
echo.

"%NODE_EXE%" --use-system-ca server\index.js

pause
