@echo off
setlocal
set ROM_DIR=J:\开源掌机\02.游戏roms分类下载
cd /d "%~dp0"

if not exist "node_modules\" (
  echo [WemuStation] node_modules not found. Running npm install first...
  call npm install || goto :fail
)
if not exist "dist\index.html" (
  echo [WemuStation] dist not found. Building frontend...
  call npm run build || goto :fail
)

echo [WemuStation] Starting server (HTTP :4464 / HTTPS :4465)...
start "WemuStation Server" /min cmd /c "node server\index.js"

timeout /t 2 /nobreak >nul

echo [WemuStation] Opening browser...
start "" "http://localhost:4464/"

echo [WemuStation] Running. Close the "WemuStation Server" window (Ctrl+C) to stop.
goto :eof

:fail
echo [WemuStation] Startup failed. See messages above.
pause
