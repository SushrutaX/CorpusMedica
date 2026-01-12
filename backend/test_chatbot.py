"""
Simple CLI test script for the RAG chatbot.
Run this to test the chatbot without the full web interface.

Usage:
    python test_chatbot.py
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Get the directory where this script is located (backend directory)
BACKEND_DIR = Path(__file__).parent

# Load environment variables from .env file in the backend directory
env_path = BACKEND_DIR / '.env'
load_dotenv(dotenv_path=env_path)

if env_path.exists():
    print(f"✅ Loaded .env from: {env_path}")
else:
    print(f"⚠️  Warning: .env file not found at {env_path}")

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.rag.chatbot import RAGChatbot


def main():
    print("=" * 60)
    print("Corpus Medica RAG Chatbot - CLI Test")
    print("=" * 60)
    print()
    
    # Check for API key
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        print("❌ ERROR: GEMINI_API_KEY environment variable not set!")
        print()
        print("Please set your Gemini API key:")
        print("  export GEMINI_API_KEY='your-api-key-here'")
        print()
        print("Get a free key from: https://makersuite.google.com/app/apikey")
        sys.exit(1)
    
    print(f"✅ GEMINI_API_KEY found: {gemini_key[:10]}...")
    print()
    
    try:
        # Initialize chatbot
        print("🔧 Initializing chatbot...")
        chatbot = RAGChatbot()
        
        # Check if indexed
        stats = chatbot.get_stats()
        print(f"📊 Status: {'✅ Indexed' if stats['indexed'] else '⚠️  Not indexed'}")
        print(f"📚 Documents: {stats['documents_count']}")
        print()
        
        # Index if needed
        if not stats['indexed']:
            print("📝 Knowledge base not indexed. Indexing now...")
            print("This may take 2-5 minutes...")
            chatbot.index_knowledge_base()
            print("✅ Indexing complete!")
            print()
        
        # Interactive chat loop
        print("💬 Chat started! Type 'exit' or 'quit' to end.")
        print("Type 'stats' to see chatbot statistics.")
        print("Type 'reindex' to rebuild the knowledge base.")
        print("-" * 60)
        print()
        
        chat_history = []
        
        while True:
            try:
                query = input("You: ").strip()
                
                if not query:
                    continue
                
                if query.lower() in ['exit', 'quit']:
                    print("\n👋 Goodbye!")
                    break
                
                if query.lower() == 'stats':
                    stats = chatbot.get_stats()
                    print()
                    print("📊 Chatbot Statistics:")
                    print(f"  Indexed: {stats['indexed']}")
                    print(f"  Documents: {stats['documents_count']}")
                    print(f"  Collection: {stats['collection_name']}")
                    print(f"  Status: {stats['status']}")
                    print()
                    continue
                
                if query.lower() == 'reindex':
                    print()
                    print("🔄 Re-indexing knowledge base...")
                    chatbot.index_knowledge_base(force_reindex=True)
                    print("✅ Re-indexing complete!")
                    print()
                    continue
                
                # Get response
                print()
                print("🤖 Thinking...")
                result = chatbot.chat(query, chat_history=chat_history, top_k=5)
                
                # Display response
                print()
                print(f"Assistant: {result['response']}")
                print()
                
                # Display sources
                if result['sources']:
                    print(f"📚 Sources ({len(result['sources'])}):")
                    for idx, source in enumerate(result['sources'], 1):
                        score_pct = int(source['score'] * 100)
                        print(f"  {idx}. [{score_pct}%] {source['type']}")
                        print(f"      {source['source']}")
                    print()
                
                # Update history
                chat_history.append({"role": "user", "content": query})
                chat_history.append({"role": "assistant", "content": result['response']})
                
                # Keep last 8 messages
                if len(chat_history) > 8:
                    chat_history = chat_history[-8:]
                
                print("-" * 60)
                print()
                
            except KeyboardInterrupt:
                print("\n\n👋 Goodbye!")
                break
            except Exception as e:
                print(f"\n❌ Error: {e}")
                print()
    
    except Exception as e:
        print(f"❌ Failed to initialize chatbot: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
