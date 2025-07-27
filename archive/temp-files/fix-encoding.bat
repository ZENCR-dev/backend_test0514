@echo off
chcp 65001 >nul
echo 🔧 修复PowerShell编码和Node.js环境...
echo.

REM 设置Node.js路径
set "NODE_PATH=C:\Program Files\nodejs"
set "PATH=%PATH%;%NODE_PATH%"

echo 📋 检查Node.js安装...
if exist "%NODE_PATH%\node.exe" (
    echo ✅ Node.js已找到
    "%NODE_PATH%\node.exe" --version
) else (
    echo ❌ Node.js未找到在 %NODE_PATH%
)

echo.
echo 📋 检查npm...
if exist "%NODE_PATH%\npm.cmd" (
    echo ✅ npm已找到
    "%NODE_PATH%\npm.cmd" --version
) else (
    echo ❌ npm未找到
)

echo.
echo 📋 测试基本命令...
node --version 2>nul && echo ✅ node命令可用 || echo ❌ node命令不可用
npm --version 2>nul && echo ✅ npm命令可用 || echo ❌ npm命令不可用

echo.
echo 📋 检查项目文件...
if exist "package.json" (
    echo ✅ package.json存在
) else (
    echo ❌ package.json不存在
)

if exist "node_modules" (
    echo ✅ node_modules存在
) else (
    echo ⚠️ node_modules不存在，需要运行 npm install
)

echo.
echo 🎯 修复完成！
echo 📝 如果命令仍不可用，请重启命令行窗口
pause