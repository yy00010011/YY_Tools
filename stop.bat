@echo off
title Git 可视化工具 - 停止

echo 正在停止 Git 可视化工具...
echo.

set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING"') do (
    set FOUND=1
    echo 结束进程 PID: %%a
    taskkill /f /pid %%a >$null 2>&1
)

echo.
if %FOUND% equ 1 (
    echo [OK] 服务已停止
) else (
    echo [提示] 未发现端口 3001 的监听进程
)
echo.
pause