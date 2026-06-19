@echo off
title Stop All

echo.
echo This will:
echo   1. Stop services on ports 3000 and 3001
echo   2. Close all command prompt windows
echo.
set /p confirm="Continue? (y/n): "

if /i not "%confirm%"=="y" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo Stopping services...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo Closing all terminals...
taskkill /f /im cmd.exe >nul 2>&1

echo Done.