@echo off
title Git 可视化工具

echo.
echo   +--------------------------------------+
echo   |     Git 可视化工具                  |
echo   |     http://localhost:3001           |
echo   +--------------------------------------+
echo.

cd /d "%~dp0"

REM 检查 node 是否可用
where node >$null 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 https://nodejs.org
    pause
    exit /b 1
)

REM 清理旧端口占用
echo [检查] 清理端口 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING"') do (
    echo [清理] 结束旧进程 PID: %%a
    taskkill /f /pid %%a >$null 2>&1
)

REM 自动安装依赖
if not exist "server\node_modules" (
    echo [安装] 安装后端依赖...
    cd server && call npm install && cd ..
)

if not exist "client\node_modules" (
    echo [安装] 安装前端依赖...
    cd client && call npm install && cd ..
)

REM 构建前端
echo [构建] 构建前端资源...
cd client
call npx webpack --mode production
cd ..

REM 启动服务
echo.
echo [就绪] 请打开浏览器访问: http://localhost:3001
echo [提示] 按 Ctrl+C 停止服务，或运行 stop.bat
echo.
cd server && call npx ts-node src/index.ts

pause