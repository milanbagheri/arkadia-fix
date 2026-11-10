@echo off
chcp 65001 >nul
title ARCADIA V - Wi-Fi LAN Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 يا جديدتر نصب نيست. از https://nodejs.org نصب کنيد.
  pause
  exit /b 1
)
if not exist node_modules (
  echo در حال نصب وابستگي‌ها...
  call npm install
  if errorlevel 1 (echo نصب ناموفق بود.& pause & exit /b 1)
)
echo.
echo سرور Wi-Fi در حال اجراست. آدرس IP را به دوستان بدهيد.
echo براي خاموش کردن سرور Ctrl+C را بزنيد.
echo.
call npm start
pause
