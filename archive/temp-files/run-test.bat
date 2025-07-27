@echo off
chcp 65001 > nul
echo Running Node.js environment test...
node simple-test.js
echo.
echo Running database check...
.\node_modules\.bin\tsx.cmd prisma-db-check.ts
pause