#!/bin/bash
# Quick fix and start script for Linux/Mac

set -e  # Exit on error

echo "========================================"
echo "Corpus Medica Chatbot - Quick Start"
echo "========================================"
echo

# Check if .env exists
if [ ! -f .env ]; then
    echo "[!] .env file not found"
    echo "Creating from .env.example..."
    cp .env.example .env
    echo
    echo "[!] Please edit .env and add your GEMINI_API_KEY"
    echo "Then run this script again."
    exit 1
fi

# Load .env
export $(cat .env | grep -v '^#' | xargs)

if [ -z "$GEMINI_API_KEY" ]; then
    echo "[!] GEMINI_API_KEY not found in .env"
    echo "Please add: GEMINI_API_KEY=your-key-here"
    exit 1
fi

echo "[1/4] Verifying setup..."
python verify_gemini_fix.py || {
    echo
    echo "[!] Verification failed. Fix issues above."
    exit 1
}

echo
echo "[2/4] Testing Gemini models..."
python test_gemini_models.py || {
    echo
    echo "[!] Model test failed. Check your API key."
    exit 1
}

echo
echo "[3/4] Installing/updating dependencies..."
pip install -q -r requirements.txt

echo
echo "[4/4] Starting backend..."
echo
echo "Backend will start at: http://localhost:8000"
echo "Chatbot UI at: http://localhost:5173"
echo
echo "Press Ctrl+C to stop"
echo

python -m uvicorn main:app --reload
