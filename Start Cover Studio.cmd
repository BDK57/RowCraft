@echo off
setlocal
cd /d "%~dp0"
set "STUDIO_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%STUDIO_NODE%" (
  "%STUDIO_NODE%" server\dev.mjs
) else (
  node server\dev.mjs
)
pause
