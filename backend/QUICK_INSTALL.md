# Quick Installation Guide

## Fix for Pillow Build Error on Python 3.13

If you're getting a Pillow build error, follow these steps:

### Option 1: Use the Installation Script (Recommended)

**On macOS/Linux:**
```bash
cd backend
chmod +x install_dependencies.sh
./install_dependencies.sh --minimal  # For testing only
# OR
./install_dependencies.sh  # For full installation
```

**On Windows:**
```cmd
cd backend
install_dependencies.bat --minimal  # For testing only
# OR
install_dependencies.bat  # For full installation
```

### Option 2: Manual Installation (Step by Step)

```bash
cd backend

# 1. Upgrade pip and build tools
pip install --upgrade pip setuptools wheel

# 2. Install Pillow first (use pre-built wheel)
pip install --only-binary :all: "Pillow>=11.0.0"
# If that fails, try:
pip install "Pillow>=11.0.0"

# 3. Install test dependencies
pip install pytest pytest-asyncio httpx

# 4. Install remaining dependencies
# For testing only (no torch/MONAI):
pip install -r requirements-tests-minimal.txt

# OR for full installation:
pip install -r requirements.txt
```

### Option 3: Install Pillow from Pre-built Wheel

If Pillow still fails to build, try installing a specific pre-built wheel:

```bash
# Check available wheels for your platform
pip install --only-binary :all: Pillow

# Or install a specific version
pip install Pillow==11.0.0
```

### Troubleshooting

**If you still get build errors:**

1. **Install system dependencies (macOS):**
   ```bash
   brew install libjpeg libpng libtiff freetype
   ```

2. **Install system dependencies (Ubuntu/Debian):**
   ```bash
   sudo apt-get install libjpeg-dev zlib1g-dev libtiff-dev libfreetype6-dev
   ```

3. **Use a different Python version:**
   - Python 3.11 or 3.12 have better package compatibility
   - Consider using `pyenv` to manage Python versions

4. **Skip Pillow if not needed for tests:**
   - Pillow is only needed for image OCR
   - You can comment it out in requirements if you're only testing text/PDF parsing

### Verify Installation

After installation, verify everything works:

```bash
# Check pytest is installed
python -m pytest --version

# Run a simple test
python -m pytest tests/test_reference_ranges.py::TestReferenceRanges::test_glucose_fasting -v
```

### For Testing Only (No Image Processing)

If you only want to test the report analysis features and don't need image OCR, you can create a minimal requirements file without Pillow:

```bash
# Create a no-image requirements file
cat requirements-tests-minimal.txt | grep -v Pillow > requirements-tests-no-image.txt
pip install -r requirements-tests-no-image.txt
```

Note: This will disable image OCR functionality, but text and PDF parsing will still work.
