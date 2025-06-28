@echo off
echo Testing Node.js environment...
echo.

REM Add Node.js to PATH
set "PATH=%PATH%;C:\Program Files\nodejs"

echo Checking Node.js...
node --version
if %errorlevel% equ 0 (
    echo Node.js is working
) else (
    echo Node.js failed
)

echo.
echo Checking npm...
npm --version
if %errorlevel% equ 0 (
    echo npm is working
) else (
    echo npm failed
)

echo.
echo Checking project files...
if exist package.json (
    echo package.json found
) else (
    echo package.json missing
)

if exist node_modules (
    echo node_modules found
) else (
    echo node_modules missing - run npm install
)

echo.
echo Test complete