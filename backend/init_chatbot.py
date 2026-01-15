#!/usr/bin/env python3
"""
Initialization script for Corpus Medica RAG Chatbot.
Checks prerequisites and guides through setup.

Usage:
    python init_chatbot.py
"""
import os
import sys
import subprocess
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def print_header(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70 + "\n")


def print_step(number, text):
    print(f"\n{'=' * 70}")
    print(f"  STEP {number}: {text}")
    print('=' * 70)


def check_python_version():
    """Check Python version is 3.8+"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ required")
        print(f"   Current version: {sys.version}")
        return False
    print(f"✅ Python version: {sys.version.split()[0]}")
    return True


def check_package(package_name):
    """Check if a Python package is installed"""
    try:
        __import__(package_name.replace('-', '_'))
        return True
    except ImportError:
        return False


def check_dependencies():
    """Check if required packages are installed"""
    print("\n📦 Checking dependencies...")
    
    required = [
        'google.generativeai',
        'chromadb',
        'sentence_transformers',
        'langchain',
        'fastapi',
    ]
    
    missing = []
    for package in required:
        module_name = package.replace('.', '_').replace('-', '_')
        if check_package(module_name):
            print(f"  ✅ {package}")
        else:
            print(f"  ❌ {package} - NOT INSTALLED")
            missing.append(package)
    
    return len(missing) == 0, missing


def check_env_file():
    """Check if .env file exists and has GEMINI_API_KEY"""
    env_path = Path(__file__).parent / '.env'
    
    if not env_path.exists():
        print("\n❌ .env file not found")
        return False, None
    
    print("\n✅ .env file found")
    
    # Check for API key
    with open(env_path) as f:
        content = f.read()
    
    if 'GEMINI_API_KEY=' in content:
        # Check if it has a value
        for line in content.split('\n'):
            if line.startswith('GEMINI_API_KEY='):
                value = line.split('=', 1)[1].strip()
                if value and value != 'your_gemini_api_key_here':
                    print(f"✅ GEMINI_API_KEY is set (length: {len(value)})")
                    return True, value
        
        print("⚠️  GEMINI_API_KEY is in .env but not set")
        return False, None
    else:
        print("⚠️  GEMINI_API_KEY not found in .env")
        return False, None


def check_chatbot_files():
    """Check if chatbot files exist"""
    print("\n📁 Checking chatbot files...")
    
    base = Path(__file__).parent
    
    required_files = [
        'app/services/rag/__init__.py',
        'app/services/rag/document_processor.py',
        'app/services/rag/vector_db.py',
        'app/services/rag/chatbot.py',
        'app/api/routes/chatbot.py',
    ]
    
    all_exist = True
    for file_path in required_files:
        full_path = base / file_path
        if full_path.exists():
            print(f"  ✅ {file_path}")
        else:
            print(f"  ❌ {file_path} - MISSING")
            all_exist = False
    
    return all_exist


def test_import():
    """Test if chatbot can be imported"""
    print("\n🔧 Testing chatbot import...")
    
    try:
        from app.services.rag import get_chatbot
        print("  ✅ Chatbot module imports successfully")
        return True
    except Exception as e:
        print(f"  ❌ Import failed: {e}")
        return False


def install_dependencies():
    """Install dependencies from requirements.txt"""
    print("\n📥 Installing dependencies...")
    print("This may take a few minutes...\n")
    
    req_file = Path(__file__).parent / 'requirements.txt'
    
    try:
        subprocess.run(
            [sys.executable, '-m', 'pip', 'install', '-r', str(req_file)],
            check=True
        )
        print("\n✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Installation failed: {e}")
        return False


def create_env_file():
    """Create .env file from example"""
    example_path = Path(__file__).parent.parent / '.env.example'
    env_path = Path(__file__).parent / '.env'
    
    if not example_path.exists():
        print("\n❌ .env.example not found")
        return False
    
    print(f"\n📝 Creating .env file...")
    
    with open(example_path) as f:
        content = f.read()
    
    with open(env_path, 'w') as f:
        f.write(content)
    
    print(f"✅ Created .env file at {env_path}")
    print("\n⚠️  IMPORTANT: Edit .env and add your GEMINI_API_KEY")
    print("   Get a free key at: https://makersuite.google.com/app/apikey")
    
    return True


def test_chatbot():
    """Test the chatbot with a simple query"""
    print("\n🧪 Testing chatbot...")
    
    try:
        from app.services.rag import get_chatbot
        
        chatbot = get_chatbot()
        
        # Check stats
        stats = chatbot.get_stats()
        print(f"\n📊 Chatbot stats:")
        print(f"  Indexed: {stats['indexed']}")
        print(f"  Documents: {stats['documents_count']}")
        
        if not stats['indexed']:
            print("\n⚠️  Knowledge base not indexed")
            print("   This is normal on first run")
            print("   Indexing will happen automatically when you start the server")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Chatbot test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print_header("Corpus Medica RAG Chatbot - Initialization Script")
    
    # Change to backend directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Step 1: Check Python version
    print_step(1, "Checking Python Version")
    if not check_python_version():
        print("\n❌ Setup failed: Python 3.8+ required")
        sys.exit(1)
    
    # Step 2: Check dependencies
    print_step(2, "Checking Dependencies")
    deps_ok, missing = check_dependencies()
    
    if not deps_ok:
        print(f"\n⚠️  Missing {len(missing)} packages: {', '.join(missing)}")
        
        response = input("\nInstall missing dependencies? (y/n): ").lower()
        if response == 'y':
            if not install_dependencies():
                print("\n❌ Setup failed: Could not install dependencies")
                sys.exit(1)
        else:
            print("\n❌ Setup aborted: Dependencies not installed")
            print("\nInstall manually with:")
            print("  pip install -r requirements.txt")
            sys.exit(1)
    
    # Step 3: Check .env file
    print_step(3, "Checking Environment Configuration")
    env_ok, api_key = check_env_file()
    
    if not env_ok:
        response = input("\nCreate .env file? (y/n): ").lower()
        if response == 'y':
            if not create_env_file():
                print("\n❌ Setup failed: Could not create .env file")
                sys.exit(1)
            
            print("\n⚠️  SETUP PAUSED")
            print("\nNext steps:")
            print("1. Edit backend/.env")
            print("2. Add your GEMINI_API_KEY=your-key-here")
            print("3. Get a free key: https://makersuite.google.com/app/apikey")
            print("4. Run this script again")
            sys.exit(0)
        else:
            print("\n❌ Setup aborted: .env file required")
            sys.exit(1)
    
    # Step 4: Check chatbot files
    print_step(4, "Checking Chatbot Files")
    if not check_chatbot_files():
        print("\n❌ Setup failed: Some chatbot files are missing")
        print("   Make sure all RAG service files were created correctly")
        sys.exit(1)
    
    # Step 5: Test import
    print_step(5, "Testing Module Import")
    if not test_import():
        print("\n❌ Setup failed: Cannot import chatbot module")
        print("   Check for syntax errors in chatbot files")
        sys.exit(1)
    
    # Step 6: Test chatbot
    print_step(6, "Testing Chatbot")
    if not test_chatbot():
        print("\n⚠️  Warning: Chatbot test failed")
        print("   This might be due to missing GEMINI_API_KEY")
        print("   Or network issues connecting to Gemini API")
    
    # Success!
    print_header("✅ SETUP COMPLETE!")
    
    print("\nYour RAG chatbot is ready! 🎉\n")
    print("Next steps:")
    print("1. Start the backend:")
    print("   cd backend")
    print("   python -m uvicorn main:app --reload")
    print()
    print("2. Or test with CLI:")
    print("   cd backend")
    print("   python test_chatbot.py")
    print()
    print("3. Or use Docker:")
    print("   docker-compose up --build")
    print()
    print("📚 Documentation:")
    print("   - CHATBOT_README.md - Quick start guide")
    print("   - CHATBOT_SETUP.md - Complete documentation")
    print("   - INTEGRATION_CHECKLIST.md - Integration guide")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
