"""
Test the actual google-genai package API to find what works
"""
import os
from pathlib import Path

# Load .env
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✅ Loaded .env from: {env_path}")
except ImportError:
    pass

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("❌ No API key found")
    exit(1)

print(f"✅ API Key: {api_key[:10]}...{api_key[-4:]}")
print()

# Test what's actually available in the package
print("=" * 60)
print("Testing google-genai package structure...")
print("=" * 60)

try:
    from google import genai
    print("✅ Imported: from google import genai")
    
    # Check what's available
    print("\n📦 Available in genai module:")
    attrs = [attr for attr in dir(genai) if not attr.startswith('_')]
    for attr in attrs:
        print(f"  - {attr}")
    
    # Try to create client
    print("\n🔧 Trying to create Client...")
    try:
        client = genai.Client(api_key=api_key)
        print("✅ Client created successfully")
        
        print("\n📦 Available in client:")
        client_attrs = [attr for attr in dir(client) if not attr.startswith('_')]
        for attr in client_attrs:
            print(f"  - {attr}")
        
        # Check if client has 'models' attribute
        if hasattr(client, 'models'):
            print("\n✅ client.models exists")
            models_attrs = [attr for attr in dir(client.models) if not attr.startswith('_')]
            print("📦 Available in client.models:")
            for attr in models_attrs:
                print(f"  - {attr}")
        else:
            print("\n❌ client.models does NOT exist")
            
    except Exception as e:
        print(f"❌ Failed to create client: {e}")
        
    # Try different approaches
    print("\n" + "=" * 60)
    print("Testing different API approaches...")
    print("=" * 60)
    
    # Approach 1: Direct REST API call
    print("\n1️⃣ Testing REST API approach...")
    try:
        import requests
        url = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent"
        headers = {"Content-Type": "application/json"}
        data = {
            "contents": [{"parts": [{"text": "Say hello"}]}]
        }
        response = requests.post(f"{url}?key={api_key}", headers=headers, json=data)
        if response.status_code == 200:
            print(f"  ✅ REST API works! Response: {response.json()}")
        else:
            print(f"  ❌ REST API failed: {response.status_code} - {response.text[:200]}")
    except Exception as e:
        print(f"  ❌ REST API error: {e}")
    
    # Approach 2: Try generative methods directly
    print("\n2️⃣ Testing if genai has generate_content...")
    if hasattr(genai, 'generate_content'):
        print("  ✅ genai.generate_content exists")
        try:
            response = genai.generate_content(
                api_key=api_key,
                model="gemini-pro",
                contents="Say hello"
            )
            print(f"  ✅ Works! Response: {response}")
        except Exception as e:
            print(f"  ❌ Failed: {e}")
    else:
        print("  ❌ genai.generate_content does NOT exist")
        
except ImportError as e:
    print(f"❌ Cannot import google.genai: {e}")
    print("\nTry installing:")
    print("  pip install google-genai>=0.2.0")

print("\n" + "=" * 60)
print("Exploration complete")
print("=" * 60)
