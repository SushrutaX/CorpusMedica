# RAG Chatbot - Quick Installation

## ✅ Status: All Files Created!

The RAG service has been successfully created with the following files:

- `backend/app/services/rag/__init__.py` - Module initialization
- `backend/app/services/rag/chatbot.py` - Main RAG chatbot implementation
- `backend/app/services/rag/document_processor.py` - Document processing utilities
- `backend/app/api/routes/chatbot.py` - API endpoints
- `backend/requirements.txt` - Updated with RAG dependencies

## 🚀 Quick Setup (3 Steps)

### Step 1: Install Dependencies

**Option A: Using setup script (Windows)**
```bash
.\setup-chatbot.bat
```

**Option B: Manual installation**
```bash
pip install google-generativeai==0.3.2 qdrant-client==1.7.0 sentence-transformers==2.2.2 python-dotenv==1.0.0
```

### Step 2: Configure API Key

Make sure you have your `GEMINI_API_KEY` in `backend/.env`:

```bash
cd backend
# Edit .env file
GEMINI_API_KEY=your_actual_api_key_here
```

Get a free key from: https://makersuite.google.com/app/apikey

### Step 3: Test It!

**Option A: Test with CLI**
```bash
cd backend
python test_chatbot.py
```

**Option B: Start full application**
```bash
# From project root
docker-compose down
docker-compose up --build
```

Then open http://localhost:5173 and click the chat button!

## 📦 What Was Installed

### Python Packages:
- **google-generativeai**: Gemini API client
- **qdrant-client**: Vector database for document retrieval
- **sentence-transformers**: Embedding model for semantic search
- **python-dotenv**: Environment variable management

### Created Files:
- **chatbot.py**: Core RAG logic with Gemini integration
- **document_processor.py**: Handles loading and chunking documents
- **__init__.py**: Exports chatbot functionality
- **routes/chatbot.py**: FastAPI endpoints for chat

## 🎯 How It Works

1. **Indexing** (First run, ~3 minutes):
   - Scans all Python/TypeScript code
   - Processes MONAI bundle configs
   - Creates embeddings
   - Stores in Qdrant vector DB

2. **Query** (2-3 seconds):
   - User asks a question
   - System finds relevant documents
   - Gemini generates answer using context
   - Returns response with sources

## 🧪 Testing

### Test 1: CLI Test
```bash
cd backend
python test_chatbot.py
```

Try asking:
- "How does the MONAI inference work?"
- "Explain the BraTS model configuration"
- "What's in the backend API?"

### Test 2: API Test
```bash
# Start backend
cd backend
python -m uvicorn main:app --reload

# In another terminal
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "How does MONAI inference work?", "history": [], "top_k": 5}'
```

### Test 3: Full Application
```bash
docker-compose up --build
```

Open http://localhost:5173 and use the chat UI!

## 🔧 Troubleshooting

### "ModuleNotFoundError: No module named 'google.generativeai'"
```bash
pip install google-generativeai==0.3.2
```

### "GEMINI_API_KEY not set"
1. Check `backend/.env` file exists
2. Make sure it contains: `GEMINI_API_KEY=your-key-here`
3. Restart the backend

### "Knowledge base not indexed"
The system will auto-index on first chat. Or manually trigger:
```bash
cd backend
python reindex_vector_db.py
```

### Docker issues
```bash
# Rebuild containers
docker-compose down
docker-compose up --build
```

## 📊 Check Status

### Get chatbot stats:
```bash
curl http://localhost:8000/api/chat/stats
```

### Check health:
```bash
curl http://localhost:8000/api/chat/health
```

## 🎉 Success Indicators

You'll know it's working when:

1. ✅ `python test_chatbot.py` shows:
   ```
   ✅ GEMINI_API_KEY found
   🔧 Initializing chatbot...
   📊 Status: ✅ Indexed
   💬 Chat started!
   ```

2. ✅ Backend logs show:
   ```
   INFO: RAG Chatbot initialized successfully
   INFO: Knowledge base already indexed (XXX documents)
   ```

3. ✅ Chat UI responds with answers and shows sources

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| Import errors | Run `pip install -r requirements.txt` |
| No GEMINI_API_KEY | Add to `backend/.env` |
| Slow first run | Normal - indexing takes 2-5 minutes |
| Docker not picking up changes | Run `docker-compose down && docker-compose up --build` |

## 📚 Next Steps

1. Test the chatbot with different questions
2. Check the source references in responses
3. Customize the system prompt in `chatbot.py`
4. Add more documents to the knowledge base

## 🆘 Still Having Issues?

1. Check backend logs:
   ```bash
   docker-compose logs -f backend
   ```

2. Verify file structure:
   ```bash
   ls backend/app/services/rag/
   # Should show: __init__.py  chatbot.py  document_processor.py
   ```

3. Test imports:
   ```bash
   cd backend
   python -c "from app.services.rag import get_chatbot; print('✅ Import successful')"
   ```

## ✅ You're All Set!

The RAG chatbot is now ready to use. Simply run:

```bash
.\setup-chatbot.bat  # Install dependencies
cd backend
python test_chatbot.py  # Test it works
```

Or start the full application:
```bash
docker-compose up --build
```

Happy chatting! 🎉
