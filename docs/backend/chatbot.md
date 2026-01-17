# RAG Chatbot (Gemini)

This module provides the Retrieval-Augmented Generation (RAG) assistant that answers questions about the Corpus Medica codebase, MONAI bundles, and workflows. The system is designed to be a developer and ops assistant, not a clinical decision tool.

## What it is (and is not)
- It is a repository-aware assistant with source citations when the index is ready.
- It is not a diagnostic engine and should not be used to interpret patient data.
- When the index is empty or still building, it falls back to general knowledge and tells the user that sources are unavailable.

## Primary entry points
- `backend/app/api/routes/chatbot.py`: `/api/chat`, `/api/chat/health`, `/api/chat/stats` endpoints.
- `backend/app/services/rag/__init__.py`: `get_chatbot()` singleton loader.
- `backend/app/services/rag/chatbot.py`: Gemini calls, Chroma store, retrieval logic.
- `backend/app/services/rag/document_processor.py`: file loading, filtering, chunk rules.

## Dependencies
- `google-generativeai`: Gemini SDK used via `genai.GenerativeModel`.
- `chromadb`: persistent vector store for embeddings.
- `sentence-transformers`: local embedding model for retrieval.

## Environment variables
- `GEMINI_API_KEY` (required): Gemini API key used by the SDK.
- `CHROMA_PATH` (optional): overrides the default Chroma persistence directory.

If `GEMINI_API_KEY` is missing or a placeholder, `/api/chat` returns a setup message instead of calling Gemini.

## Gemini configuration and model selection
Initialization tries a fallback list of model names in order until one works:
- `gemini-2.5-flash`
- `models/gemini-2.5-flash`
- `gemini-1.5-pro-latest`
- `gemini-1.5-flash-latest`
- `gemini-pro`
- `models/gemini-1.5-pro-latest`
- `models/gemini-1.5-flash-latest`
- `models/gemini-pro`

The first model that initializes is used for all subsequent requests in that process. The model is created with the Google SDK (not a custom REST client).

### Generation configuration
- `temperature = 0.2` for lower variance responses.
- `max_output_tokens = 650` to keep answers compact for UI panels.

## Lazy initialization and lifecycle
The RAG chatbot is initialized lazily:
- The first call to `get_chatbot()` builds the singleton instance.
- That first call loads the embedding model, connects to Chroma, and initializes Gemini.
- This means the first chat request can be slower due to model load time.

## Vector store and persistence
Chroma persistence is resolved in this order:
1) If `CHROMA_PATH` is set, use it.
2) Else, if `backend/chroma_db/chroma.sqlite3` exists, use `backend/chroma_db`.
3) Else, fall back to `backend/chroma_storage`.

Chroma collection details:
- Collection name: `corpus_medica_docs`
- Space: cosine (`metadata={"hnsw:space": "cosine"}`)

## Embeddings
- Embedding model: `all-MiniLM-L6-v2`
- Dimension: auto-detected via `get_sentence_embedding_dimension()` (typically 384)
- Embeddings are generated locally with `SentenceTransformer.encode()`.

## Indexing: what gets embedded
The indexing pipeline is implemented in `RAGChatbot.index_knowledge_base()` and uses `DocumentProcessor`.

### Prioritized sources
1) Any `chroma_db` directories found at:
   - `backend/chroma_db`
   - `chroma_db`
2) `BRATS_README.md` at project root
3) `backend/scripts/download_monai_bundles.py`
4) All files in `models/bundles/**`
5) Backend source code (`backend/**`)
6) Frontend source code (`frontend/src/**`)

### File type filtering
`DocumentProcessor.should_process_file()` allows only text-like files. Key extensions include:
- `.py`, `.md`, `.txt`, `.json`, `.yaml`, `.yml`
- `.ts`, `.tsx`, `.js`, `.jsx`, `.html`, `.css`
- `.sh`, `.bat`, `.ps1`, `.sql`, `.toml`, `.ini`

### Excluded paths
Files are skipped if they match common exclusions:
- `.git`, `node_modules`, `.venv`, `__pycache__`
- `dist`, `build`, `.next`, `coverage`
- `chroma_storage`, `chroma.sqlite3`

### Metadata stored per document
Each document stores metadata that is later returned as sources:
- `source` (relative path)
- `type` (ex: `python_code`, `monai_bundle`, `documentation`)
- `filename`, `extension`
- `chunk_index` (only for chunked content)

### Chunking rules and limitations
- Default `chunk_size = 1500` characters
- Default `chunk_overlap = 200`
- Current behavior: large files return only the first chunk for speed.
  The full `chunk_text()` logic exists but is not used for large files yet.

## Indexing lifecycle and background thread
- On each chat request, the system checks if the collection has documents.
- If the collection is empty, it starts a background indexing thread.
- While indexing, responses indicate that sources are not yet available.

This avoids blocking the first request, but the first few answers may not include citations until indexing completes.

## Query flow (request to response)
1) Frontend sends `query`, `history`, `top_k` to `/api/chat`.
2) Backend checks `GEMINI_API_KEY` and loads the singleton chatbot if needed.
3) If indexed, retrieve context via Chroma. If not, index in background.
4) Build a prompt that includes:
   - Context snippets
   - Recent chat history
   - The new user question
5) Send the prompt to Gemini and return the response.
6) Return `response` text plus `sources` list with scores.

### History and top_k limits
- API validates `top_k` between 1 and 8.
- The RAG layer clamps to `MAX_TOP_K = 4`.
- The prompt includes only the last `MAX_HISTORY_MESSAGES = 4` chat messages.
- The frontend sends up to 6 messages and uses `top_k=4`.

### Context limits
Context is truncated to keep prompts small:
- `MAX_CONTEXT_CHARS = 1400` per retrieved document.
- Context snippets end at word boundaries when truncated.

## Prompt format
The system prompt enforces a structured, plain-text response:
- Answer: 3 to 6 sentences.
- Steps: short actionable steps (if applicable).
- Notes: risks, caveats, or assumptions.
- Sources: file paths or "None (indexing in progress)".

Markdown is discouraged in the prompt. The exception is the fallback message from `/api/chat` when the RAG service cannot import (that message includes markdown).

## Response schema
`POST /api/chat` returns:
- `response`: a plain-text answer from Gemini.
- `sources`: list of `{ source, type, score }` objects.

Score is computed as `1.0 - distance` where `distance` is the cosine distance returned by Chroma.

## Health and stats endpoints
- `GET /api/chat/health` returns:
  - `chatbot_enabled`
  - `api_key_configured`
  - `rag_service` status
  - `knowledge_base_indexed` and `documents_count` (if available)

- `GET /api/chat/stats` returns:
  - `indexed`
  - `documents_count`
  - `collection_name`
  - `status`

## Operational workflows
Common scripts in `backend/`:
- `init_chatbot.py`: setup checks and optional test run.
- `test_chatbot.py`: CLI test without frontend.
- `reindex_vector_db.py`: force rebuild of embeddings.
- `test_gemini_models.py`: probe available Gemini models.

## Failure modes and diagnosis
- Missing `GEMINI_API_KEY`: `/api/chat` returns a setup response.
- Model mismatch: Gemini errors surface in the response text and backend logs.
- Empty collection: answer returns with `Sources: None (indexing in progress)`.
- Chroma errors: `/api/chat/health` reports `rag_service` as `error: ...`.

## Performance notes
- The first chat request is slowest due to model initialization.
- Indexing time scales with repo size and bundle count.
- Retrieval and prompt assembly are lightweight once indexed.
- `MAX_CONTEXT_CHARS` and `MAX_TOP_K` are tuned to limit latency.

## Security and privacy
- The index contains local code and docs. Do not index PHI.
- The chatbot is informational only and should be behind auth controls in production.

## Future improvements
- Full-file chunking (multi-chunk indexing for large files)
- Streaming responses for long answers
- Swapable vector stores (Qdrant or pgvector)
- Caching for repeated queries
- Multiple collections for different documentation domains
