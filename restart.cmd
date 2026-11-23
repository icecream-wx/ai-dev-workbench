@echo off
setlocal

rem ================================================================
rem  AI Dev Workbench - Windows restart script
rem  Usage: restart.cmd
rem  Flow : stop -> build backend/frontend (inside start.cmd) -> start -> health check
rem  Stop failure aborts the restart (no extra kills, no PID changes here).
rem ================================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo [workbench] restart: stop -^> build -^> start
call "%ROOT%\stop.cmd"
if errorlevel 1 (
  echo [workbench] ERROR: stop failed; abort restart.
  endlocal & exit /b 1
)

call "%ROOT%\start.cmd"
set "RC=%errorlevel%"
endlocal & exit /b %RC%
