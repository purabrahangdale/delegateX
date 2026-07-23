@echo off
:: ============================================================
::  DelegateX Backend Startup Script (CMD/Batch)
::  Usage: start.bat  (from the backend\ directory)
:: ============================================================

setlocal

set VENV_DIR=%~dp0venv
set PYTHON=%VENV_DIR%\Scripts\python.exe
set ACTIVATE=%VENV_DIR%\Scripts\activate.bat
set REQS=%~dp0requirements.txt

echo.
echo ==================================================
echo   DelegateX Backend Startup
echo ==================================================
echo.

:: ── 1. Ensure virtual environment exists ──────────────────
if not exist "%PYTHON%" (
    echo [INFO] Virtual environment not found. Creating...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        exit /b 1
    )
    echo [OK]   Virtual environment created.
) else (
    echo [OK]   Virtual environment found.
)

:: ── 2. Activate virtual environment ───────────────────────
echo [INFO] Activating virtual environment...
call "%ACTIVATE%"

:: ── 3. Install deps if uvicorn is missing ─────────────────
"%PYTHON%" -m uvicorn --version >nul 2>&1
if errorlevel 1 (
    echo [WARN] uvicorn not found. Installing dependencies...
    "%PYTHON%" -m pip install --upgrade pip
    "%PYTHON%" -m pip install -r "%REQS%"
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed.
        exit /b 1
    )
    echo [OK]   Dependencies installed.
) else (
    echo [OK]   uvicorn is available.
)

:: ── 4. Start the backend ───────────────────────────────────
echo.
echo [INFO] Starting FastAPI server on http://127.0.0.1:8000 ...
echo [INFO] Press Ctrl+C to stop.
echo.

cd /d "%~dp0"
"%PYTHON%" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
