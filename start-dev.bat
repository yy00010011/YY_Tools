@echo off
title Git 可视化工具 (开发模式)

echo Git 可视化工具 - 开发模式
echo http://localhost:3001
echo.

cd /d "%~dp0"

REM 清理旧端口占用
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING"') do (
    echo [清理] 结束旧进程 PID: %%a
    taskkill /f /pid %%a >$null 2>&1
)

echo [启动] 启动后端服务...
cd server && call npx ts-node src/index.ts
pause