#!/bin/bash
# Quick Start Script for Corpus Medica Chatbot
# This script helps you quickly test the chatbot setup

echo "=================================="
echo "Corpus Medica - Chatbot Quick Start"
echo "=================================="
echo ""

# Change to backend directory
cd "$(dirname "$0")"

echo "📁 Working directory: $(pwd)"
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo "✅ .env file found"
else
    echo "❌ .env file NOT found!"
    echo "   Please create a .env file with your GEMINI_API_KEY"
    exit 1
fi

echo ""
echo "Running diagnostic check..."
echo ""

# Run diagnostic
python check_env.py

echo ""
echo "=================================="
echo "Press Enter to start the chatbot..."
echo "Or Ctrl+C to exit"
echo "=================================="
read

# Run chatbot
python test_chatbot.py
