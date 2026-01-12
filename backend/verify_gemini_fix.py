#!/usr/bin/env python3
"""
Quick fix script for Gemini model compatibility.
Run this to verify your setup after updating chatbot.py
"""
import os
import sys
from pathlib import Path

def check_env():
    """Check if GEMINI_API_KEY is set"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY not set")
        print("\nSet it with:")
        print("  export GEMINI_API_KEY='your-key'  # Linux/Mac")
        print("  set GEMINI_API_KEY=your-key      # Windows")
        print("\nOr add to backend/.env:")
        print("  GEMINI_API_KEY=your-key-here")
        return False
    
    print(f"✅ GEMINI_API_KEY found: {api_key[:10]}...{api_key[-4:]}")
    return True

def check_dependencies():
    """Check if required packages are installed"""
    print("\n📦 Checking dependencies...")
    
    required = [
        'google.generativeai',
        'qdrant_client',
        'sentence_transformers',
        'langchain',
        'langchain_google_genai'
    ]
    
    missing = []
    for package in required:
        try:
            __import__(package.replace('-', '_'))
            print(f"  ✅ {package}")
        except ImportError:
            print(f"  ❌ {package} - NOT INSTALLED")
            missing.append(package)
    
    if missing:
        print("\n❌ Missing packages. Install with:")
        print("  cd backend")
        print("  pip install -r requirements.txt")
        return False
    
    return True

def check_chatbot_file():
    """Check if chatbot.py has been updated"""
    print("\n📄 Checking chatbot.py...")
    
    chatbot_file = Path(__file__).parent / "app" / "services" / "rag" / "chatbot.py"
    
    if not chatbot_file.exists():
        print(f"❌ File not found: {chatbot_file}")
        return False
    
    content = chatbot_file.read_text()
    
    # Check for updated model names
    if 'gemini-1.5-flash-latest' in content:
        print("  ✅ Model names updated")
        return True
    elif 'gemini-1.5-flash' in content and 'gemini-1.5-flash-latest' not in content:
        print("  ⚠️  Still using old model name")
        print("  Please update chatbot.py with the fix")
        return False
    else:
        print("  ⚠️  Could not verify model names")
        return False

def test_import():
    """Test if chatbot can be imported"""
    print("\n🧪 Testing chatbot import...")
    
    try:
        # Add parent dir to path
        sys.path.insert(0, str(Path(__file__).parent))
        
        from app.services.rag.chatbot import RAGChatbot
        print("  ✅ Chatbot import successful")
        return True
    except Exception as e:
        print(f"  ❌ Import failed: {e}")
        return False

def main():
    print("=" * 60)
    print("🔧 Gemini Model Fix - Verification Script")
    print("=" * 60)
    
    checks = [
        ("Environment", check_env),
        ("Dependencies", check_dependencies),
        ("Chatbot File", check_chatbot_file),
        ("Import Test", test_import),
    ]
    
    results = []
    for name, check_func in checks:
        print(f"\n{'='*60}")
        print(f"Checking: {name}")
        print('='*60)
        results.append(check_func())
    
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    
    for (name, _), result in zip(checks, results):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    all_passed = all(results)
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ All checks passed!")
        print("\nNext steps:")
        print("1. Run: python test_gemini_models.py")
        print("   (to verify which models work)")
        print("2. Restart backend:")
        print("   python -m uvicorn main:app --reload")
        print("3. Test chatbot:")
        print("   curl http://localhost:8000/api/chat/health")
    else:
        print("❌ Some checks failed")
        print("\nFix the issues above, then run this script again")
        print("\nFor detailed help, see:")
        print("  backend/GEMINI_MODEL_FIX.md")
    
    print("=" * 60)
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
