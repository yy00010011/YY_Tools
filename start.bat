@echo off
title Git Visual Tool

cd /d "%~dp0"

echo Starting Git Visual Tool...
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [Error] Node.js not found
    pause
    exit /b 1
)

echo [Clean] Killing old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [Install] Checking dependencies...
if not exist "node_modules" call npm install
if not exist "server\node_modules" (pushd server && call npm install && popd)
if not exist "client\node_modules" (pushd client && call npm install && popd)

echo [Build] Building project...
call npm run build

echo.
echo [Start] Starting services...
start "Git Server" cmd /k "cd /d server && npm start"
start "Git Client" cmd /k "cd /d client && npm start"

echo.
echo [Ready] Services started successfully!
echo   Server: http://localhost:3001
echo   Client: http://localhost:3000
echo.
echo [Hint] Close the windows to stop services
echo.

pause