@echo off
REM Quick fix and start script for Windows

echo ========================================
echo Corpus Medica Chatbot - Quick Start
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo [!] .env file not found
    echo Creating from .env.example...
    copy .env.example .env
    echo.
    echo [!] Please edit .env and add your GEMINI_API_KEY
    echo Then run this script again.
    pause
    exit /b 1
)

REM Load .env (basic version)
for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
    if "%%a"=="GEMINI_API_KEY" set GEMINI_API_KEY=%%b
)

if "%GEMINI_API_KEY%"=="" (
    echo [!] GEMINI_API_KEY not found in .env
    echo Please add: GEMINI_API_KEY=your-key-here
    pause
    exit /b 1
)

echo [1/4] Verifying setup...
python verify_gemini_fix.py
if errorlevel 1 (
    echo.
    echo [!] Verification failed. Fix issues above.
    pause
    exit /b 1
)

echo.
echo [2/4] Testing Gemini models...
python test_gemini_models.py
if errorlevel 1 (
    echo.
    echo [!] Model test failed. Check your API key.
    pause
    exit /b 1
)

echo.
echo [3/4] Installing/updating dependencies...
pip install -q -r requirements.txt

echo.
echo [4/4] Starting backend...
echo.
echo Backend will start at: http://localhost:8000
echo Chatbot UI at: http://localhost:5173
echo.
echo Press Ctrl+C to stop
echo.

python -m uvicorn main:app --reload
