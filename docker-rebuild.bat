@echo off
REM Complete Docker Rebuild Script for CorpusMedica
echo =============================================
echo Complete Docker Rebuild Script for CorpusMedica
echo =============================================
echo.

echo Step 1: Stopping all containers...
docker-compose down

echo.
echo Step 2: Removing conflicting containers...
docker rm -f medai-postgres 2>nul
docker rm -f medai-backend 2>nul
docker rm -f medai-auth 2>nul
docker rm -f medai-frontend 2>nul
docker rm -f medai-ollama 2>nul
docker rm -f corpusmedica-ollama-1 2>nul

echo.
echo Step 3: Removing old images (optional, press Ctrl+C to skip)...
timeout /t 5
docker-compose down --rmi all --volumes --remove-orphans

echo.
echo Step 4: Building and starting containers...
docker-compose up --build -d

echo.
echo =============================================
echo Build complete!
echo =============================================
echo.
echo To view logs, run: docker-compose logs -f
echo To stop containers, run: docker-compose down
echo.
pause
