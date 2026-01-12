@echo off
REM Docker Cleanup Script for CorpusMedica (Updated - Removes Ollama)
echo =================================================
echo Docker Cleanup Script for CorpusMedica
echo =================================================
echo.

echo Stopping all running containers...
docker-compose down

echo.
echo Removing old/conflicting containers...
docker rm -f medai-postgres 2>nul
docker rm -f medai-ollama 2>nul
docker rm -f corpusmedica-ollama-1 2>nul
docker rm -f medai-backend 2>nul
docker rm -f medai-auth 2>nul
docker rm -f medai-frontend 2>nul

echo.
echo Removing unused Ollama volume...
docker volume rm corpusmedica_ollama_models 2>nul

echo.
echo Cleanup complete!
echo.
echo Now run: docker-compose up --build
echo.
pause
