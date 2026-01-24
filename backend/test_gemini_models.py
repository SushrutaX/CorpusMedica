"""
Test Gemini REST API directly (no SDK dependencies)
"""
import os
import requests
from pathlib import Path
import sys

# Force UTF-8 for Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Load .env
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✅ Loaded .env from: {env_path}")
except ImportError:
    print("⚠️  python-dotenv not installed")

print("\n" + "=" * 60)
print("🧪 Gemini REST API Test")
print("=" * 60)

# Get API key
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("\n❌ GEMINI_API_KEY not found!")
    print("\nSet it in backend/.env:")
    print("  GEMINI_API_KEY=your-key-here")
    exit(1)

print(f"\n✅ API Key found: {api_key[:10]}...{api_key[-4:]}")

# Test models
models_to_test = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash-exp',
]

print("\n" + "=" * 60)
print("Testing Gemini models via REST API...")
print("=" * 60)

working_models = []

for model_name in models_to_test:
    print(f"\n🔍 Testing: {model_name}")
    
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        headers = {"Content-Type": "application/json"}
        data = {
            "contents": [{
                "parts": [{"text": "Say 'Hello' in one word"}]
            }]
        }
        
        response = requests.post(
            f"{url}?key={api_key}",
            headers=headers,
            json=data,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if 'candidates' in result and len(result['candidates']) > 0:
                text = result['candidates'][0]['content']['parts'][0]['text']
                print(f"  ✅ SUCCESS - Response: {text[:50]}")
                working_models.append(model_name)
            else:
                print(f"  ⚠️  Got response but no content")
        elif response.status_code == 429:
            print(f"  ⚠️  QUOTA EXCEEDED - You've hit the free tier limit")
            print(f"      Wait a bit or upgrade at: https://makersuite.google.com/")
        elif response.status_code == 404:
            print(f"  ❌ NOT FOUND - Model not available with your API key")
        else:
            error = response.json() if response.text else {}
            error_msg = error.get('error', {}).get('message', response.text[:100])
            print(f"  ❌ FAILED - {response.status_code}: {error_msg}")
            
    except requests.exceptions.Timeout:
        print(f"  ❌ TIMEOUT - Request took too long")
    except Exception as e:
        print(f"  ❌ ERROR - {str(e)[:100]}")

print("\n" + "=" * 60)
print("📊 SUMMARY")
print("=" * 60)
print(f"\nTested: {len(models_to_test)} models")
print(f"Working: {len(working_models)} models")

if working_models:
    print("\n✅ These models work with your API key:")
    for model in working_models:
        print(f"  - {model}")
    print(f"\n💡 The chatbot will use: {working_models[0]}")
    print("\n" + "=" * 60)
    print("✅ TEST PASSED!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Run: python test_chatbot.py")
    print("2. Start backend: python -m uvicorn main:app --reload")
    exit(0)
else:
    print("\n❌ No working models found!")
    print("\nPossible issues:")
    print("1. API key expired or invalid")
    print("2. Quota exceeded (429 error)")
    print("3. API key doesn't have access to Gemini models")
    print("\nSolutions:")
    print("- Get new API key: https://makersuite.google.com/app/apikey")
    print("- Wait for quota reset (if 429 error)")
    print("- Check API key permissions in Google AI Studio")
    print("\n" + "=" * 60)
    print("❌ TEST FAILED")
    print("=" * 60)
    exit(1)
