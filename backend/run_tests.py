#!/usr/bin/env python3
"""
Test runner script for report analysis features
"""
import sys
import subprocess
from pathlib import Path

def main():
    """Run all tests"""
    backend_dir = Path(__file__).parent
    tests_dir = backend_dir / "tests"
    
    print("=" * 60)
    print("Running Tests for Report Analysis Features")
    print("=" * 60)
    print()
    
    # Run pytest
    cmd = [
        sys.executable, "-m", "pytest",
        str(tests_dir),
        "-v",
        "--tb=short",
    ]
    
    if len(sys.argv) > 1:
        cmd.extend(sys.argv[1:])
    else:
        cmd.append("--color=yes")
    
    result = subprocess.run(cmd, cwd=str(backend_dir))
    return result.returncode

if __name__ == "__main__":
    sys.exit(main())
