@echo off
setlocal EnableExtensions
title Tutor Value Local Server
cd /d "%~dp0"

set "CODEX_PY=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if exist "%CODEX_PY%" goto use_codex_python

py -3 --version >nul 2>nul
if not errorlevel 1 goto use_py_launcher

python --version >nul 2>nul
if not errorlevel 1 goto use_python_path

goto no_python

:use_codex_python
set "PYTHON_CMD=%CODEX_PY%"
goto start_server

:use_py_launcher
set "PYTHON_CMD=py -3"
goto start_server

:use_python_path
set "PYTHON_CMD=python"
goto start_server

:start_server
echo Starting Tutor Value...
echo Your browser should open http://127.0.0.1:8765
echo Keep this window open while using the app.
echo.
%PYTHON_CMD% "%~dp0server.py"
set "SERVER_EXIT=%ERRORLEVEL%"
if "%SERVER_EXIT%"=="0" goto normal_exit
goto failed

:failed
echo.
echo Tutor Value failed to start. Error code: %SERVER_EXIT%
echo Common causes: port 8765 is already in use, or security software blocked the local server.
echo Please take a screenshot of the complete error shown above.
pause
exit /b %SERVER_EXIT%

:no_python
echo Python 3 was not found, so Tutor Value cannot start.
echo Make sure the Codex runtime still exists, or install Python 3 and try again.
echo Download Python from https://www.python.org/downloads/
pause
exit /b 1

:normal_exit
echo.
echo Tutor Value has stopped.
pause
exit /b 0
