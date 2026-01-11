# RAG Chatbot Setup Guide

## Overview
The Corpus Medica platform now includes an AI-powered chatbot that can answer questions about:
- Backend and frontend codebase architecture
- MONAI bundle configurations and internals
- Specific models stored in `/models/bundles`
- General ML and medical imaging theory

## Prerequisites

1. **Gemini API Key** (Required)
   - Get your free API key from: https://makersuite.google.com/app/apikey
   - You'll need a Google account
   - Free tier: 60 requests per minute

## Installation Steps

### 1. Set Up Environment Variables

Create a `.env` file in the backend directory:

```bash
cd backend
cp ../.env.example .env
```

Edit `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This will install:
- `google-generativeai` - Gemini API client
- `qdrant-client` - Vector database
- `sentence-transformers` - Embedding model
- `langchain` - RAG framework

### 3. Start the Backend

```bash
# From backend directory
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or using Docker:

```bash
# From project root
docker-compose up --build
```

### 4. Index the Knowledge Base

On first run, the chatbot will automatically index the knowledge base. This takes 2-5 minutes and includes:
- All Python backend code
- All TypeScript frontend code  
- README and documentation
- MONAI bundle configurations
- MONAI bundle docs

You can manually trigger re-indexing via the API:

```bash
curl -X POST http://localhost:8000/api/chat/index \
  -H "Content-Type: application/json" \
  -d '{"force_reindex": true}'
```

### 5. Update Frontend (Manual Step)

Replace your `frontend/src/App.tsx` with the updated version:

```bash
cd frontend/src
# Backup your current App.tsx
cp App.tsx App.tsx.backup

# The updated version shows how to integrate ChatSidebar
# See App-Updated.tsx.example for the changes needed
```

Key changes to make in `App.tsx`:

1. Import ChatSidebar:
```typescript
import ChatSidebar from './components/ChatSidebar';
```

2. Add state for chat sidebar:
```typescript
const [chatSidebarOpen, setChatSidebarOpen] = useState<boolean>(false);
```

3. Add chat button to hero section:
```typescript
<button 
  type="button"
  className="meta-chip chat-trigger"
  onClick={() => setChatSidebarOpen(true)}
  style={{ 
    cursor: 'pointer', 
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
    color: 'white', 
    border: 'none' 
  }}
>
  💬 Ask AI Assistant
</button>
```

4. Add ChatSidebar component before closing `</div>`:
```typescript
<ChatSidebar 
  isOpen={chatSidebarOpen}
  onClose={() => setChatSidebarOpen(false)}
  apiBase={API_BASE}
/>
```

### 6. Start the Frontend

```bash
cd frontend
npm install  # If not already done
npm run dev
```

Visit: http://localhost:5173

## Usage

### Chat Interface

1. Click the **"💬 Ask AI Assistant"** button in the hero section
2. A sidebar will slide in from the right
3. Type your question and press Enter or click Send
4. The assistant will:
   - Retrieve relevant context from the codebase
   - Generate a response using Gemini
   - Show source references with relevance scores

### Example Questions

Try asking:
- "How does the MONAI bundle inference work?"
- "Explain the BraTS model architecture"
- "What's the difference between the backend routes?"
- "How do I add a new model to the platform?"
- "What preprocessing is done for CT scans?"
- "Show me the spleen segmentation model configuration"

### API Endpoints

#### POST /api/chat
```json
{
  "query": "How does MONAI bundle inference work?",
  "history": [
    {"role": "user", "content": "previous question"},
    {"role": "assistant", "content": "previous answer"}
  ],
  "top_k": 5
}
```

Response:
```json
{
  "response": "MONAI bundle inference works by...",
  "sources": [
    {
      "source": "/backend/app/services/inference.py",
      "type": "python_code",
      "score": 0.87
    }
  ],
  "context_used": 5
}
```

#### POST /api/chat/index
Trigger manual indexing:
```json
{
  "force_reindex": true
}
```

#### GET /api/chat/stats
Get chatbot statistics:
```json
{
  "indexed": true,
  "documents_count": 127,
  "collection_name": "corpus_medica_kb",
  "status": "green"
}
```

#### GET /api/chat/health
Health check for chatbot service.

## Architecture

### Components

1. **Document Processor** (`backend/app/services/rag/document_processor.py`)
   - Extracts code from Python and TypeScript files
   - Parses JSON configurations
   - Chunks markdown documentation
   - Processes MONAI bundle metadata

2. **Vector Database** (`backend/app/services/rag/vector_db.py`)
   - Uses Qdrant for vector storage
   - Defaults to in-memory storage (development)
   - Can use persistent storage with `QDRANT_PATH` env var
   - COSINE similarity for retrieval

3. **RAG Chatbot** (`backend/app/services/rag/chatbot.py`)
   - Sentence-Transformers for embeddings (`all-MiniLM-L6-v2`)
   - Gemini Pro for response generation
   - Context window management
   - Source attribution

4. **Frontend Component** (`frontend/src/components/ChatSidebar.tsx`)
   - Sliding sidebar interface
   - Message history
   - Source references with scores
   - Suggested questions

### Data Flow

1. User asks question in chat UI
2. Frontend sends request to `/api/chat`
3. Backend:
   - Generates embedding for question
   - Searches vector DB for top-k relevant documents
   - Constructs prompt with context + chat history
   - Calls Gemini API
4. Response returned with source attributions
5. Frontend displays message with expandable sources

## Configuration

### Vector Database

**In-Memory (Default)**
```env
# No configuration needed
# Data lost on restart
```

**Persistent Storage**
```env
QDRANT_PATH=/data/qdrant
```

### Embedding Model

Default: `all-MiniLM-L6-v2` (384-dimensional, fast, good quality)

To change, edit `backend/app/services/rag/chatbot.py`:
```python
self.embedding_model = SentenceTransformer('your-model-name')
```

Options:
- `all-MiniLM-L6-v2` - Small, fast (default)
- `all-mpnet-base-v2` - Larger, better quality
- `multi-qa-mpnet-base-dot-v1` - Optimized for Q&A

### LLM Model

Default: `gemini-pro`

To change, edit `backend/app/services/rag/chatbot.py`:
```python
self.model = genai.GenerativeModel('gemini-1.5-pro')  # More powerful
```

### Retrieval Parameters

Adjust in chat request or code:
- `top_k`: Number of documents to retrieve (default: 5)
- Context window: Last 4 messages (adjust in `generate_response`)

## Troubleshooting

### "GEMINI_API_KEY environment variable must be set"
- Make sure you created `.env` in the backend directory
- Verify your API key is correct
- Restart the backend server

### "Knowledge base not indexed"
```bash
curl -X POST http://localhost:8000/api/chat/index \
  -H "Content-Type: application/json" \
  -d '{"force_reindex": true}'
```

### Slow indexing
- Initial indexing takes 2-5 minutes
- Progress logged in backend console
- Subsequent starts are instant (if using persistent storage)

### Chat not responding
1. Check backend logs for errors
2. Verify Gemini API key is valid
3. Check API rate limits (60 req/min free tier)
4. Ensure `/api/chat` endpoint is accessible

### Sources not showing
- Sources are only shown for assistant messages
- Click the "📚 N sources" button to expand
- Relevance scores shown as percentages

## Performance

### Indexing
- ~150 documents from full codebase
- ~3 minutes on first run
- Instant on subsequent runs (with persistent storage)

### Query Response
- Embedding generation: <100ms
- Vector search: <50ms
- Gemini API call: 1-3 seconds
- Total: ~2-4 seconds per query

### Memory Usage
- Embedding model: ~400MB RAM
- In-memory Qdrant: ~50MB for 150 docs
- Persistent Qdrant: ~20MB disk space

## Production Deployment

For production use:

1. **Use persistent Qdrant:**
```env
QDRANT_PATH=/app/data/qdrant
```

2. **Consider external Qdrant server:**
```python
self.client = QdrantClient(host="qdrant-server", port=6333)
```

3. **Rate limiting:**
   - Gemini free tier: 60 req/min
   - Add request queuing or caching

4. **Security:**
   - Keep `GEMINI_API_KEY` secret
   - Add authentication to chat endpoints
   - Validate and sanitize user inputs

5. **Monitoring:**
   - Log all queries and responses
   - Track API usage and costs
   - Monitor error rates

## Advanced Customization

### Add Custom Documents

Edit `document_processor.py` to process additional file types:

```python
def process_custom_format(file_path: Path) -> List[Document]:
    # Your custom processing logic
    pass

# Add to process_all_documents()
all_documents.extend(process_custom_format(your_files))
```

### Change Prompt Template

Edit `chatbot.py` in the `generate_response()` method:

```python
prompt = f"""Your custom system message here...

CONTEXT:
{context_text}

QUESTION: {query}

RESPONSE:"""
```

### Adjust Context Window

In `chatbot.py`:
```python
# More history context
for msg in chat_history[-10:]:  # Last 10 messages instead of 4
    ...
```

## Cost Estimation

**Gemini API (Free Tier)**
- 60 requests per minute
- 32,000 tokens per request (input)
- Free for personal use

**Paid Tier** (if needed):
- $0.00025 per 1K input tokens
- $0.00075 per 1K output tokens
- ~100 queries/day ≈ $0.05/day

## Support

For issues:
1. Check backend logs: `docker-compose logs backend`
2. Check frontend console: Browser DevTools
3. Verify API endpoints: http://localhost:8000/docs
4. Review this guide thoroughly

## Future Enhancements

Potential improvements:
- [ ] Support for more LLM providers (OpenAI, Claude, etc.)
- [ ] Multi-language support
- [ ] Voice input/output
- [ ] Code execution sandbox
- [ ] Image analysis integration
- [ ] User feedback and rating system
- [ ] Conversation export
- [ ] Custom knowledge base upload
