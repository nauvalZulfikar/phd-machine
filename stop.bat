@echo off
REM career-ops stop — Windows
REM Kills both quick-mode processes (by window title) and PM2 apps if present.

echo Stopping career-ops...

REM Kill the named windows (quick mode)
taskkill /F /FI "WindowTitle eq career-ops serve*" 2>nul
taskkill /F /FI "WindowTitle eq career-ops cron*" 2>nul

REM Kill anything listening on the dashboard port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4280 ^| findstr LISTENING') do (
  echo Killing PID %%a on :4280
  taskkill /F /PID %%a 2>nul
)

REM PM2 cleanup if present
where pm2 >nul 2>nul
if not errorlevel 1 (
  pm2 stop career-ops-serve career-ops-cron 2>nul
  pm2 delete career-ops-serve career-ops-cron 2>nul
)

echo Done.
