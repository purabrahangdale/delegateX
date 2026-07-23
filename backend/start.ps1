# ============================================================
#  DelegateX Backend Startup Script (PowerShell)
#  Usage: .\start.ps1
#  Always run from: backend\
# ============================================================

$ErrorActionPreference = "Stop"

$VENV_DIR  = Join-Path $PSScriptRoot "venv"
$PYTHON    = Join-Path $VENV_DIR "Scripts\python.exe"
$ACTIVATE  = Join-Path $VENV_DIR "Scripts\Activate.ps1"
$REQS      = Join-Path $PSScriptRoot "requirements.txt"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  DelegateX Backend Startup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Ensure virtual environment exists ─────────────────────
if (-Not (Test-Path $PYTHON)) {
    Write-Host "[INFO] Virtual environment not found at: $VENV_DIR" -ForegroundColor Yellow
    Write-Host "[INFO] Creating virtual environment with system Python..." -ForegroundColor Yellow
    python -m venv $VENV_DIR
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to create virtual environment." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK]   Virtual environment created." -ForegroundColor Green
} else {
    Write-Host "[OK]   Virtual environment found." -ForegroundColor Green
}

# ── 2. Activate the virtual environment ──────────────────────
Write-Host "[INFO] Activating virtual environment..." -ForegroundColor Cyan
& $ACTIVATE

# ── 3. Check if uvicorn is installed; install deps if missing ─
$uvicornCheck = & $PYTHON -m uvicorn --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] uvicorn not found in venv. Installing dependencies from requirements.txt..." -ForegroundColor Yellow
    & $PYTHON -m pip install --upgrade pip
    & $PYTHON -m pip install -r $REQS
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Dependency installation failed. Check requirements.txt and your internet connection." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK]   Dependencies installed." -ForegroundColor Green
} else {
    Write-Host "[OK]   $uvicornCheck" -ForegroundColor Green
}

# ── 4. Start the backend server ───────────────────────────────
Write-Host ""
Write-Host "[INFO] Starting FastAPI server on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
Write-Host "[INFO] Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

Set-Location $PSScriptRoot
& $PYTHON -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
