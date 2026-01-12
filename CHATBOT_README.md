# Corpus Medica - RAG Chatbot Quick Start

## 🚀 What's New: AI-Powered Knowledge Assistant

Your Corpus Medica platform now includes an intelligent chatbot that can answer questions about:
- ✅ Backend & frontend code architecture
- ✅ MONAI bundle configurations and internals
- ✅ Specific models in `/models/bundles`
- ✅ ML and medical imaging theory

## ⚡ Quick Setup (5 minutes)

### 1. Get Gemini API Key (Free)
```bash
# Visit: https://makersuite.google.com/app/apikey
# Click "Create API Key"
# Copy your key
```

### 2. Configure Environment
```bash
# In project root
cp .env.example .env

# Edit .env and add:
GEMINI_API_KEY=your_actual_key_here
```

### 3. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 4. Start the Application
```bash
# Option A: Docker (recommended)
docker-compose up --build

# Option B: Manual
cd backend
python -m uvicorn main:app --reload

# In another terminal:
cd frontend
npm install
npm run dev
```

### 5. Use the Chatbot

**Web Interface:**
1. Open http://localhost:5173
2. Click **"💬 Ask AI Assistant"** button in the hero section
3. Start asking questions!

**CLI Testing:**
```bash
cd backend
export GEMINI_API_KEY='your-key-here'  # Linux/Mac
# or
set GEMINI_API_KEY=your-key-here      # Windows

python test_chatbot.py
```

## 💡 Example Questions

Try asking:
```
How does the MONAI bundle inference work?
Explain the BraTS model architecture
What preprocessing is done for CT scans?
Show me the spleen segmentation configuration
How do I add a new model to the platform?
What's the difference between the API routes?
```

## 📚 Full Documentation

See [CHATBOT_SETUP.md](./CHATBOT_SETUP.md) for:
- Detailed setup instructions
- API endpoint documentation
- Architecture overview
- Troubleshooting guide
- Production deployment tips

## 🎯 Key Features

- **Contextual Answers**: Retrieves relevant code and documentation
- **Source Attribution**: Shows which files the answer came from
- **Chat History**: Maintains conversation context
- **Fast Indexing**: ~3 minutes to index entire codebase
- **Real-time**: Responses in 2-4 seconds

## 🔧 API Endpoints

```bash
# Chat
POST /api/chat
{
  "query": "How does MONAI inference work?",
  "history": [...],
  "top_k": 5
}

# Index knowledge base
POST /api/chat/index
{"force_reindex": true}

# Get stats
GET /api/chat/stats

# Health check
GET /api/chat/health
```

## 🐳 Docker Support

The chatbot works seamlessly with Docker:

```bash
# Start with Docker Compose
docker-compose up --build

# The chatbot will auto-index on first run
# Subsequent starts are instant
```

## 🎨 Frontend Integration

The chat sidebar is already integrated! Just make sure you've updated `App.tsx`:

```typescript
import ChatSidebar from './components/ChatSidebar';

// Add state
const [chatSidebarOpen, setChatSidebarOpen] = useState(false);

// Add button
<button onClick={() => setChatSidebarOpen(true)}>
  💬 Ask AI Assistant
</button>

// Add component
<ChatSidebar 
  isOpen={chatSidebarOpen}
  onClose={() => setChatSidebarOpen(false)}
  apiBase={API_BASE}
/>
```

## 🔐 Security Note

**Never commit your `.env` file!** It contains your API key.

The `.gitignore` already excludes:
- `.env`
- `*.env`
- Environment files

## 🆘 Troubleshooting

**"GEMINI_API_KEY not set"**
```bash
# Make sure .env is in the backend directory
ls backend/.env

# Restart backend after adding key
```

**"Knowledge base not indexed"**
```bash
curl -X POST http://localhost:8000/api/chat/index \
  -d '{"force_reindex": true}'
```

**Chat not responding**
- Check backend logs: `docker-compose logs backend`
- Verify API key is valid
- Ensure frontend can reach `http://localhost:8000`

## 📊 Architecture

```
User Question
     ↓
Frontend Chat Sidebar
     ↓
POST /api/chat
     ↓
RAG Service:
  1. Generate query embedding
  2. Search vector DB (Qdrant)
  3. Retrieve top-5 relevant docs
  4. Build context + history
  5. Call Gemini API
     ↓
Response with sources
     ↓
Display in chat UI
```

## 🎁 What's Included

**Backend:**
- `backend/app/services/rag/` - RAG service implementation
- `backend/app/api/routes/chatbot.py` - API routes
- `backend/test_chatbot.py` - CLI testing tool

**Frontend:**
- `frontend/src/components/ChatSidebar.tsx` - Chat UI component
- `frontend/src/components/ChatSidebar.css` - Styling

**Documentation:**
- `CHATBOT_SETUP.md` - Complete setup guide
- `CHATBOT_README.md` - This file

## 💰 Cost

**Free Tier (Development)**
- Gemini API: 60 requests/minute free
- Perfect for development and testing

**Paid Tier (Production)**
- ~$0.05/day for typical usage
- See [CHATBOT_SETUP.md](./CHATBOT_SETUP.md) for details

## 🚀 Next Steps

1. Complete the 5-minute setup above
2. Test the chatbot with example questions
3. Read [CHATBOT_SETUP.md](./CHATBOT_SETUP.md) for advanced features
4. Customize the system prompt in `chatbot.py`
5. Add custom documents to the knowledge base

## 🤝 Contributing

The chatbot is fully customizable:
- Add new document types in `document_processor.py`
- Change embedding models in `chatbot.py`
- Modify UI in `ChatSidebar.tsx`
- Adjust prompts for your use case

## 📞 Support

For issues:
1. Check [CHATBOT_SETUP.md](./CHATBOT_SETUP.md) troubleshooting section
2. Review backend logs
3. Verify API endpoints at http://localhost:8000/docs
4. Test with CLI tool: `python backend/test_chatbot.py`

---

**Ready to chat? Follow the 5-minute setup above! 🚀**
