@echo off
setlocal enabledelayedexpansion
title QuantLab Self-Healing Launcher

echo ===================================================
echo             QuantLab Platform Launcher             
echo ===================================================
echo.

cd /d "%~dp0"

:: 1. Verify or create backend/.env
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        echo [*] backend\.env not found. Initializing from backend\.env.example...
        copy "backend\.env.example" "backend\.env" >nul
        echo [OK] Created backend\.env with default demo configuration.
    ) else (
        echo [*] Creating fresh backend\.env...
        (
            echo INDIAN_API_KEY=your_indian_api_key_here
            echo INDIAN_API_BASE_URL=https://stock.indianapi.in
            echo GEMINI_API_KEY=
            echo OPENAI_API_KEY=
            echo GROQ_API_KEY=
        ) > "backend\.env"
        echo [OK] Created default backend\.env.
    )
)

:: 2. Check Python environment and dependencies
echo [*] Checking Python environment...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH! Please install Python 3.10+.
    pause
    exit /b 1
)

:: Check for virtual environment or install dependencies
if not exist ".venv" (
    echo [*] Creating virtual environment (.venv)...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    echo [*] Installing backend dependencies...
    python -m pip install --upgrade pip
    python -m pip install -r backend\requirements.txt
) else (
    if exist ".venv\Scripts\activate.bat" (
        call .venv\Scripts\activate.bat
    )
)

:: 3. Check Node.js and frontend dependencies
echo [*] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH! Please install Node.js 18+.
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo [*] Installing frontend dependencies (this may take a minute)...
    cd frontend
    call npm.cmd install
    cd ..
)

echo.
echo ===================================================
echo [OK] All dependencies verified! Launching servers...
echo ===================================================
echo.

:: 4. Launch Backend (Port 8000)
echo [*] Launching FastAPI Backend on port 8000...
start "QuantLab Backend (FastAPI)" cmd /k "cd /d "%~dp0" && if exist .venv\Scripts\activate.bat (call .venv\Scripts\activate.bat) && python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000"

:: 5. Launch Frontend (Port 5173)
echo [*] Launching Vite Frontend on port 5173...
start "QuantLab Frontend (Vite)" cmd /k "cd /d "%~dp0\frontend" && call npm.cmd run dev -- --host 127.0.0.1 --port 5173"

echo.
echo ===================================================
echo  QuantLab is now live!
echo  - Frontend:  http://127.0.0.1:5173
echo  - Backend:   http://127.0.0.1:8000
echo  - API Docs:  http://127.0.0.1:8000/docs
echo ===================================================
echo.
