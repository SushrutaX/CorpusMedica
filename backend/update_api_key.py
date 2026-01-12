"""
Quick helper to update your expired API key in .env file
"""
import os
from pathlib import Path

def update_api_key():
    print("=" * 60)
    print("🔑 Gemini API Key Update Helper")
    print("=" * 60)
    print()
    
    env_path = Path(__file__).parent / '.env'
    
    if not env_path.exists():
        print(f"❌ .env file not found at: {env_path}")
        print("\nCreating new .env file...")
        env_path.write_text("""# Environment Variables for Corpus Medica Platform

# Gemini API Key (REQUIRED for chatbot)
GEMINI_API_KEY=your-api-key-here

# Qdrant Vector Database Path (optional - defaults to :memory:)
# For persistent storage, set to a directory path
# QDRANT_PATH=/data/qdrant

# Backend API Base URL (for frontend)
VITE_API_BASE_URL=http://localhost:8000

# Feature Flags
VITE_ENABLE_3D_VIEWER=true
VITE_ENABLE_VIEWER_WORKSPACE=true

# Model Settings
# MONAI_ROI_SIZE=128,128,128  # Optional: Override ROI size for GPU memory limits
""")
        print(f"✅ Created .env template at: {env_path}")
    else:
        print(f"✅ Found .env file at: {env_path}")
    
    # Read current .env
    content = env_path.read_text()
    
    # Check current key
    current_key = None
    for line in content.split('\n'):
        if line.startswith('GEMINI_API_KEY=') and not line.startswith('#'):
            current_key = line.split('=', 1)[1].strip()
            break
    
    if current_key and current_key != 'your-api-key-here':
        print(f"\n📋 Current API key: {current_key[:10]}...{current_key[-4:]}")
        print("⚠️  This key is EXPIRED according to your error message")
    else:
        print("\n⚠️  No API key found in .env")
    
    print("\n" + "=" * 60)
    print("🔗 Get a NEW API key:")
    print("=" * 60)
    print("\n1. Open this URL in your browser:")
    print("   https://makersuite.google.com/app/apikey")
    print("\n2. Click 'Create API Key' or 'Get API Key'")
    print("\n3. Copy the NEW key")
    print("\n4. Come back here and paste it")
    print("\n" + "=" * 60)
    
    new_key = input("\n📝 Paste your NEW API key here (or press Enter to skip): ").strip()
    
    if not new_key:
        print("\n⚠️  No key entered. You can manually edit .env file:")
        print(f"   {env_path}")
        print("\n   Find this line:")
        print(f"   GEMINI_API_KEY={current_key if current_key else 'your-api-key-here'}")
        print("\n   Replace with:")
        print("   GEMINI_API_KEY=your-new-key-here")
        return False
    
    # Validate key format (basic check)
    if not new_key.startswith('AIza'):
        print("\n⚠️  Warning: API key should start with 'AIza'")
        confirm = input("   Continue anyway? (y/N): ").strip().lower()
        if confirm != 'y':
            print("❌ Cancelled")
            return False
    
    # Update .env file
    if current_key:
        new_content = content.replace(f'GEMINI_API_KEY={current_key}', f'GEMINI_API_KEY={new_key}')
    else:
        # Add the key
        new_content = content.replace('GEMINI_API_KEY=your-api-key-here', f'GEMINI_API_KEY={new_key}')
    
    # Write back
    env_path.write_text(new_content)
    
    print("\n✅ Updated .env file successfully!")
    print(f"✅ New key: {new_key[:10]}...{new_key[-4:]}")
    print(f"\n📁 Location: {env_path}")
    
    print("\n" + "=" * 60)
    print("🧪 Next steps:")
    print("=" * 60)
    print("\n1. Test the new key:")
    print("   python test_gemini_models.py")
    print("\n2. Test chatbot:")
    print("   python test_chatbot.py")
    print("\n3. Start backend:")
    print("   python -m uvicorn main:app --reload")
    print("\n" + "=" * 60)
    
    return True


if __name__ == "__main__":
    try:
        update_api_key()
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
