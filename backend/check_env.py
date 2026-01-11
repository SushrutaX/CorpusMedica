"""
Environment troubleshooting script for Corpus Medica RAG Chatbot
Run this to diagnose environment variable and dependency issues.
"""
import os
import sys
from pathlib import Path

def check_environment():
    """Check all environment requirements"""
    print("=" * 70)
    print("Corpus Medica - Environment Diagnostic Tool")
    print("=" * 70)
    print()
    
    # 1. Check Python version
    print("1️⃣  Python Version:")
    print(f"   {sys.version}")
    print()
    
    # 2. Check current directory
    print("2️⃣  Current Working Directory:")
    print(f"   {os.getcwd()}")
    print()
    
    # 3. Check script location
    script_dir = Path(__file__).parent
    print("3️⃣  Script Location:")
    print(f"   {script_dir}")
    print()
    
    # 4. Check .env file
    env_path = script_dir / '.env'
    print("4️⃣  .env File:")
    if env_path.exists():
        print(f"   ✅ Found at: {env_path}")
        print(f"   Size: {env_path.stat().st_size} bytes")
    else:
        print(f"   ❌ NOT FOUND at: {env_path}")
    print()
    
    # 5. Load .env and check variables
    print("5️⃣  Loading .env file...")
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=env_path)
        print("   ✅ python-dotenv loaded successfully")
    except ImportError:
        print("   ❌ python-dotenv not installed")
        print("   Install with: pip install python-dotenv")
        return
    print()
    
    # 6. Check GEMINI_API_KEY
    print("6️⃣  GEMINI_API_KEY Environment Variable:")
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        print(f"   ✅ Set: {gemini_key[:10]}...{gemini_key[-4:]}")
        print(f"   Length: {len(gemini_key)} characters")
    else:
        print("   ❌ NOT SET")
        print()
        print("   To fix this:")
        print("   1. Make sure the .env file exists in the backend directory")
        print("   2. Add this line to the .env file:")
        print("      GEMINI_API_KEY=your-api-key-here")
        print("   3. Get a key from: https://makersuite.google.com/app/apikey")
    print()
    
    # 7. Check required packages
    print("7️⃣  Required Packages:")
    packages = [
        'google.generativeai',
        'sentence_transformers',
        'qdrant_client',
        'fastapi',
        'uvicorn'
    ]
    
    for package in packages:
        try:
            __import__(package)
            print(f"   ✅ {package}")
        except ImportError:
            print(f"   ❌ {package} - NOT INSTALLED")
    print()
    
    # 8. Check Google Generative AI specifically
    print("8️⃣  Google Generative AI Package:")
    try:
        import google.generativeai as genai
        print(f"   ✅ Imported successfully")
        print(f"   Note: You may see a deprecation warning. This is normal.")
        print(f"         The package still works, but Google recommends")
        print(f"         migrating to 'google.genai' in the future.")
    except ImportError as e:
        print(f"   ❌ Import failed: {e}")
    print()
    
    # 9. Test Gemini API connection
    if gemini_key:
        print("9️⃣  Testing Gemini API Connection:")
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel('gemini-pro')
            response = model.generate_content("Say 'Hello, Corpus Medica!' in one sentence.")
            print(f"   ✅ API connection successful!")
            print(f"   Response: {response.text[:100]}...")
        except Exception as e:
            print(f"   ❌ API connection failed: {e}")
    print()
    
    print("=" * 70)
    print("Diagnostic Complete!")
    print("=" * 70)
    

if __name__ == "__main__":
    check_environment()
