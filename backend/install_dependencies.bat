@echo off
REM Installation script for Windows that handles Pillow build issues on Python 3.13

echo Installing dependencies for CorpusMedica backend...
echo.

REM Step 1: Upgrade pip and setuptools
echo Step 1: Upgrading pip and setuptools...
pip install --upgrade pip setuptools wheel

REM Step 2: Install Pillow first (use pre-built wheel if available)
echo.
echo Step 2: Installing Pillow (Python 3.13 compatible)...
pip install --only-binary :all: "Pillow>=11.0.0" || pip install "Pillow>=11.0.0"

REM Step 3: Install test dependencies first (lightweight)
echo.
echo Step 3: Installing test dependencies...
pip install pytest pytest-asyncio httpx

REM Step 4: Install remaining dependencies
echo.
echo Step 4: Installing remaining dependencies...
if "%1"=="--minimal" (
    echo Using minimal requirements (for testing only)...
    pip install -r requirements-tests-minimal.txt
) else (
    echo Using full requirements...
    pip install -r requirements.txt
)

echo.
echo Installation complete!
echo.
echo To run tests:
echo   python -m pytest tests/ -v
