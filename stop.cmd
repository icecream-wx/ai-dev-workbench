@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ================================================================
rem  AI Dev Workbench - Windows stop script
rem  Stops the process tree from data\workbench.pid (includes opencode serve).
rem  Falls back to the process listening on PORT when the pid file is gone.
rem  Every kill target must be this workbench's backend (node.exe + dist\index.js).
rem ================================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

set "PID_FILE=%ROOT%\data\workbench.pid"

rem Resolve PORT with the same precedence as dotenv in the backend:
rem process environment PORT > backend\.env PORT > 3300.
set "PORT_FROM_SHELL="
if defined PORT set "PORT_FROM_SHELL=!PORT!"
set "PORT_FROM_FILE="

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

rem An unusable PORT must not block stopping by pid file; it only disables the
rem port fallback, which would otherwise probe the wrong port.
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
  echo [workbench] WARN: invalid PORT "!PORT!" - must be an integer in 1..65535 ^(no leading zeros^); port fallback disabled.
)

set "KILLED=0"
set "STOPPED_PID="

rem Is the pid really this workbench's backend (node.exe running dist\index.js)?
rem Sets IS_WB=1 only on a match; anything else must not be killed.
if exist "%PID_FILE%" (
  set "OLD_PID="
  set /p OLD_PID=<"%PID_FILE%"
  if defined OLD_PID (
    tasklist /FI "PID eq !OLD_PID!" /NH 2>nul | findstr /C:"!OLD_PID!" >nul
    if not errorlevel 1 (
      set "IS_WB=0"
      powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-CimInstance Win32_Process -Filter 'ProcessId=!OLD_PID!'; if ($p -and $p.Name -eq 'node.exe' -and $p.CommandLine -match 'dist[\\/]index\.js') { exit 0 } else { exit 1 }"
      if not errorlevel 1 set "IS_WB=1"
      if "!IS_WB!"=="1" (
        echo [workbench] stopping process tree ^(PID !OLD_PID!^)...
        taskkill /PID !OLD_PID! /T /F >nul 2>nul
        set "KILLED=1"
        set "STOPPED_PID=!OLD_PID!"
      ) else (
        echo [workbench] WARN: pid file points to PID !OLD_PID!, which is not this workbench. Not killed.
      )
    ) else (
      echo [workbench] stale pid file ^(process !OLD_PID! not running^).
    )
  )
  del /q "%PID_FILE%" >nul 2>nul
)

rem Fallback: pid file missing or stale, find the listener on PORT.
rem Only stop it when it is really this workbench; otherwise refuse and warn.
if "!KILLED!"=="0" (
  if "!PORT_OK!"=="1" (
    set "PORT_PID="
    for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr /R /C:":%PORT% .*LISTENING"') do set "PORT_PID=%%P"
    if defined PORT_PID (
      set "IS_WB=0"
      powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-CimInstance Win32_Process -Filter 'ProcessId=!PORT_PID!'; if ($p -and $p.Name -eq 'node.exe' -and $p.CommandLine -match 'dist[\\/]index\.js') { exit 0 } else { exit 1 }"
      if not errorlevel 1 set "IS_WB=1"
      if "!IS_WB!"=="0" (
        echo [workbench] WARN: port %PORT% is held by PID !PORT_PID!, which is not this workbench. Not killed.
        echo [workbench]       Inspect it with: tasklist /FI "PID eq !PORT_PID!"
        goto :exit1
      )
      echo [workbench] port %PORT% is held by PID !PORT_PID!, stopping it...
      taskkill /PID !PORT_PID! /T /F >nul 2>nul
      set "KILLED=1"
      set "STOPPED_PID=!PORT_PID!"
    )
  )
)

if "!KILLED!"=="1" (
  if "!PORT_OK!"=="1" (
    ping -n 2 127.0.0.1 >nul
    set "STILL="
    for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr /R /C:":%PORT% .*LISTENING"') do set "STILL=%%P"
    if defined STILL (
      echo [workbench] WARN: port %PORT% is still held by PID !STILL! after stop.
      goto :exit1
    )
  )
  echo [workbench] stopped ^(PID !STOPPED_PID!^).
) else (
  if "!PORT_OK!"=="1" (
    echo [workbench] no running workbench process found ^(port %PORT% is free^).
  ) else (
    echo [workbench] no running workbench process found ^(port check skipped: invalid PORT^).
  )
)

endlocal & exit /b 0

:exit1
endlocal & exit /b 1
