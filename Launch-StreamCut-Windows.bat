@echo off
title StreamCut — Launching App...
cd /d "%~dp0"

echo ========================================================
echo   StreamCut — StreamLadder AI Clipper
echo   Starting desktop application...
echo ========================================================

:: Check if server is already running on port 5173
netstat -ano | findstr /R ":5173.*LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Server is already running.
) else (
    echo Starting StreamCut server...
    start /min "StreamCut-Server" node server.mjs --lan
    call :waitready
)

:: Find modern browser to launch in dedicated app window mode
set BROWSER_CMD=
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set BROWSER_CMD="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set BROWSER_CMD="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set BROWSER_CMD="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set BROWSER_CMD="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
)

if defined BROWSER_CMD (
    echo Launching native desktop window...
    %BROWSER_CMD% --app=http://localhost:5173 --window-size=1280,820
) else (
    start http://localhost:5173
)

exit

:: Wait until the server actually answers HTTP, up to 30s.
:waitready
set /a WAITTRIES=0
:waitready_loop
powershell -NoProfile -Command "try { $null = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }"
if not errorlevel 1 exit /b 0
set /a WAITTRIES+=1
if %WAITTRIES% GEQ 30 exit /b 1
timeout /t 1 /nobreak >nul
goto waitready_loop
