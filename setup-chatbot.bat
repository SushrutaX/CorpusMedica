@echo off
REM Setup script for RAG Chatbot - Fixed Versions

echo ================================================
echo Corpus Medica RAG Chatbot Setup (Fixed)
echo ================================================
echo.

echo Step 1: Uninstalling conflicting packages...
echo.
pip uninstall -y sentence-transformers huggingface-hub transformers

echo.
echo Step 2: Installing compatible versions...
echo.
pip install sentence-transformers==2.3.1 transformers==4.36.2 huggingface-hub==0.20.3

echo.
echo Step 3: Installing remaining dependencies...
echo.
pip install google-generativeai==0.3.2 qdrant-client==1.7.0 python-dotenv==1.0.0

echo.
echo ================================================
echo Step 4: Checking environment setup...
echo ================================================
echo.

cd backend
python -c "import os; from dotenv import load_dotenv; load_dotenv(); key = os.getenv('GEMINI_API_KEY'); print('✅ GEMINI_API_KEY is set') if key and key != 'your_gemini_api_key_here' else print('❌ GEMINI_API_KEY not set. Please add it to backend/.env')"

echo.
echo ================================================
echo Step 5: Testing imports...
echo ================================================
echo.
python -c "from sentence_transformers import SentenceTransformer; print('✅ sentence-transformers working')"
python -c "import google.generativeai; print('✅ google-generativeai working')"
python -c "from qdrant_client import QdrantClient; print('✅ qdrant-client working')"

echo.
echo ================================================
echo Setup Complete!
echo ================================================
echo.
echo To test the chatbot:
echo   cd backend
echo   python test_chatbot.py
echo.
echo To start the full application:
echo   docker-compose up --build
echo.
pause
