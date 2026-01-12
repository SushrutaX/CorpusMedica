@echo off
REM Quick Start Script for Corpus Medica Chatbot (Windows)
REM This script helps you quickly test the chatbot setup

echo ==================================
echo Corpus Medica - Chatbot Quick Start
echo ==================================
echo.

REM Change to backend directory (where this script is located)
cd /d "%~dp0"

echo 📁 Working directory: %CD%
echo.

REM Check if .env exists
if exist ".env" (
    echo ✅ .env file found
) else (
    echo ❌ .env file NOT found!
    echo    Please create a .env file with your GEMINI_API_KEY
    pause
    exit /b 1
)

echo.
echo Running diagnostic check...
echo.

REM Run diagnostic
python check_env.py

echo.
echo ==================================
echo Press any key to start the chatbot...
echo Or Ctrl+C to exit
echo ==================================
pause >nul

REM Run chatbot
python test_chatbot.py

pause
