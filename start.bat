@echo off
REM career-ops 24/7 launcher — Windows
REM
REM Quick mode (no PM2):  start.bat
REM PM2 mode:             start.bat pm2
REM Stop:                 stop.bat

cd /d %~dp0
setlocal

if "%1"=="pm2" goto pm2

REM ─── Quick mode: just spawn both processes as background windows ───
echo Starting career-ops in quick mode (no PM2)...
echo.

REM Kill any previous instance on the dashboard port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4280 ^| findstr LISTENING') do (
  echo Killing existing process on :4280 (PID %%a)
  taskkill /F /PID %%a 2>nul
)

start "career-ops serve" /MIN cmd /c "node auto/serve.mjs >> tmp/serve.log 2>&1"
echo   ✓ serve started → http://localhost:4280

start "career-ops cron" /MIN cmd /c "node auto/cron.mjs >> tmp/cron-stdout.log 2>&1"
echo   ✓ cron started (scan portals 6h / linkedin 12h / dashboard 1h)

echo.
echo Logs:
echo   tmp/serve.log
echo   tmp/cron.log (structured)
echo   tmp/cron-stdout.log
echo.
echo Stop with: stop.bat
goto end

:pm2
echo Starting career-ops with PM2...
where pm2 >nul 2>nul
if errorlevel 1 (
  echo PM2 not found. Install:  npm install -g pm2
  exit /b 1
)
pm2 start ecosystem.config.cjs
pm2 save
pm2 ls
echo.
echo Auto-start on Windows boot:
echo   npm install -g pm2-windows-startup
echo   pm2-startup install
echo   pm2 save

:end
endlocal
