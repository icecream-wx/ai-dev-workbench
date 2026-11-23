@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ================================================================
rem  AI Dev Workbench - Windows start script
rem  Usage: double-click start.cmd, or run it from cmd / PowerShell
rem  Flow : check env -> install deps if missing -> build -> start -> health check
rem  Stop : run stop.cmd
rem ================================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

set "PID_FILE=%ROOT%\data\workbench.pid"
set "LOG_DIR=%ROOT%\data\logs"
set "OUT_LOG=%LOG_DIR%\workbench.log"
set "ERR_LOG=%LOG_DIR%\workbench.error.log"
rem Resolve PORT with the same precedence as dotenv in the backend:
rem process environment PORT > backend\.env PORT > 3300.
set "PORT_FROM_SHELL="
if defined PORT set "PORT_FROM_SHELL=!PORT!"
set "PORT_FROM_FILE="

rem Read PORT from backend\.env (same value the backend reads via dotenv).
rem "usebackq" is required: without it cmd treats the quoted path as a literal
rem string and never opens the file.
if exist "%ROOT%\backend\.env" (
  set "ENV_KEY="
  set "ENV_VAL="
  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ROOT%\backend\.env") do (
    set "ENV_KEY=%%A"
    set "ENV_KEY=!ENV_KEY: =!"
    if /i "!ENV_KEY:~0,6!"=="export" set "ENV_KEY=!ENV_KEY:~6!"
    if "!ENV_KEY!"=="PORT" set "ENV_VAL=%%B"
  )
  if defined ENV_VAL (
    set "ENV_VAL=!ENV_VAL: =!"
    set "ENV_VAL=!ENV_VAL:"=!"
    set "ENV_VAL=!ENV_VAL:'=!"
    rem Drop an inline comment (dotenv allows "PORT=3300 # note").
    for /f "tokens=1 delims=#" %%C in ("!ENV_VAL!") do set "ENV_VAL=%%C"
    set "PORT_FROM_FILE=!ENV_VAL!"
  )
)

set "PORT=3300"
if defined PORT_FROM_FILE set "PORT=!PORT_FROM_FILE!"
if defined PORT_FROM_SHELL set "PORT=!PORT_FROM_SHELL!"

rem PORT must be an integer in 1..65535. Reject anything else before building.
rem Digit-only scan (no shell metacharacters interpreted) + length + range checks.
set "PORT_OK=0"
set "PORT_BAD="
for /f "delims=0123456789" %%Z in ("!PORT!") do set "PORT_BAD=1"
if not defined PORT_BAD if defined PORT if not "!PORT:~0,1!"=="0" set "PORT_OK=1"
if "!PORT_OK!"=="1" (
  set "PORT_TAIL=!PORT:~5!"
  if defined PORT_TAIL (
    set "PORT_OK=0"
  ) else (
    if !PORT! GTR 65535 set "PORT_OK=0"
  )
)
if "!PORT_OK!"=="0" (
  echo [workbench] ERROR: invalid PORT "!PORT!" - must be an integer in 1..65535 ^(no leading zeros^).
  echo [workbench]        Fix the PORT environment variable or backend\.env, then retry.
  goto :exit1
)

set "HEALTH_URL=http://127.0.0.1:%PORT%/api/health"

echo [workbench] project dir: %ROOT%
echo [workbench] port: %PORT%

where node >nul 2>nul
if errorlevel 1 (
  echo [workbench] ERROR: node not found. Install Node.js 20+ and add it to PATH.
  goto :exit1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [workbench] ERROR: npm not found. Check your Node.js installation.
  goto :exit1
)

where opencode >nul 2>nul
if errorlevel 1 (
  if not defined OPENCODE_BIN echo [workbench] WARN: opencode not found in PATH; requirements/design/dev sessions will be unavailable until installed or OPENCODE_BIN is set.
)

rem Do not start twice
if exist "%PID_FILE%" (
  set "OLD_PID="
  set /p OLD_PID=<"%PID_FILE%"
  if defined OLD_PID (
    tasklist /FI "PID eq !OLD_PID!" /NH 2>nul | findstr /C:"!OLD_PID!" >nul
    if not errorlevel 1 (
      echo [workbench] already running ^(PID !OLD_PID!^). Run restart.cmd to rebuild and restart ^(or stop.cmd then start.cmd^).
      goto :exit1
    )
  )
  del /q "%PID_FILE%" >nul 2>nul
)

rem Port must be free
set "BUSY_PID="
for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr /R /C:":%PORT% .*LISTENING"') do set "BUSY_PID=%%P"
if defined BUSY_PID (
  echo [workbench] ERROR: port %PORT% is already in use by PID !BUSY_PID!. Free it or change PORT in backend\.env.
  goto :exit1
)

rem Install dependencies when node_modules is missing (e.g. after deleting frontend\node_modules)
if not exist "%ROOT%\backend\node_modules" (
  echo [workbench] installing backend dependencies...
  pushd "%ROOT%\backend"
  call npm install
  set "INSTALL_RC=!errorlevel!"
  popd
  if not "!INSTALL_RC!"=="0" goto :fail
)
if not exist "%ROOT%\frontend\node_modules" (
  echo [workbench] installing frontend dependencies...
  pushd "%ROOT%\frontend"
  call npm install
  set "INSTALL_RC=!errorlevel!"
  popd
  if not "!INSTALL_RC!"=="0" goto :fail
)

echo [workbench] building backend ^(tsc^)...
call npm run build --prefix backend
if errorlevel 1 (
  echo [workbench] ERROR: backend build failed ^(tsc^).
  goto :fail
)
echo [workbench] building frontend ^(vite^)...
call npm run build --prefix frontend
if errorlevel 1 (
  echo [workbench] ERROR: frontend build failed ^(vite^).
  goto :fail
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [workbench] starting service...
for /f "delims=" %%N in ('where node') do set "NODE_EXE=%%N"
if not defined NODE_EXE (
  echo [workbench] ERROR: cannot resolve node.exe path.
  goto :fail
)

rem Write the pid file from PowerShell itself. Do not capture its stdout with for /f:
rem the long-lived node child would inherit the pipe and keep cmd waiting forever.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process -FilePath '%NODE_EXE%' -ArgumentList 'dist/index.js' -WorkingDirectory '%ROOT%\backend' -RedirectStandardOutput '%OUT_LOG%' -RedirectStandardError '%ERR_LOG%' -WindowStyle Hidden -PassThru; Set-Content -LiteralPath '%PID_FILE%' -Value $p.Id -Encoding Ascii"
if errorlevel 1 goto :start_failed

set "NEW_PID="
if exist "%PID_FILE%" set /p NEW_PID=<"%PID_FILE%"
if not defined NEW_PID (
  echo [workbench] ERROR: failed to start the node process.
  goto :start_failed
)

echo [workbench] process started ^(PID !NEW_PID!^), waiting for health check...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='%HEALTH_URL%'; for ($i = 0; $i -lt 60; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $url; if ($r.StatusCode -eq 200) { exit 0 } } catch { }; Start-Sleep -Milliseconds 500 }; exit 1"
if errorlevel 1 goto :start_failed

echo.
echo [workbench] started successfully
echo   URL      : http://localhost:%PORT%
echo   PID      : !NEW_PID!
echo   Log      : %OUT_LOG%
echo   Error log: %ERR_LOG%
echo   Stop     : run stop.cmd
echo.
endlocal & exit /b 0

:exit1
endlocal & exit /b 1

:start_failed
echo [workbench] startup failed, recent log:
if exist "%ERR_LOG%" powershell -NoProfile -Command "Get-Content -LiteralPath '%ERR_LOG%' -Tail 40"
if exist "%OUT_LOG%" powershell -NoProfile -Command "Get-Content -LiteralPath '%OUT_LOG%' -Tail 40"
taskkill /PID !NEW_PID! /T /F >nul 2>nul
del /q "%PID_FILE%" >nul 2>nul
exit /b 1

:fail
echo [workbench] dependency install or build failed, aborted.
exit /b 1
