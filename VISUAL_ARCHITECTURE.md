# Corpus Medica RAG Chatbot - Visual Architecture

## 🎯 System Overview

```
┌────────────────────────────────────────────────────────────────┐
│                     CORPUS MEDICA PLATFORM                      │
│                   Medical AI Segmentation System                │
└────────────────────────────────────────────────────────────────┘
                              │
                              │
          ┌───────────────────┴────────────────────┐
          │                                        │
          ▼                                        ▼
┌──────────────────────┐              ┌──────────────────────┐
│   ORIGINAL SYSTEM    │              │   NEW RAG CHATBOT    │
│                      │              │                      │
│  • Upload Scans      │              │  • Ask Questions     │
│  • Select Models     │              │  • Get Answers       │
│  • Run Segmentation  │              │  • View Sources      │
│  • View Results      │              │  • Chat History      │
└──────────────────────┘              └──────────────────────┘
```

## 📦 Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐                    ┌─────────────────────┐ │
│  │  Main App UI   │                    │   ChatSidebar.tsx   │ │
│  │                │                    │                     │ │
│  │  • Upload      │                    │  • Message List     │ │
│  │  • Models      │    Click Button    │  • Input Field      │ │
│  │  • Results     │ ──────────────────>│  • Source Display   │ │
│  │  • Viewer      │    Opens Sidebar   │  • Suggestions      │ │
│  │                │                    │                     │ │
│  └────────────────┘                    └─────────┬───────────┘ │
│                                                  │             │
└──────────────────────────────────────────────────┼─────────────┘
                                                   │
                                                   │ POST /api/chat
                                                   │
┌──────────────────────────────────────────────────┼─────────────┐
│                      BACKEND (FastAPI)           │             │
├──────────────────────────────────────────────────┼─────────────┤
│                                                  ▼             │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              API Routes (chatbot.py)                   │   │
│  │                                                        │   │
│  │  POST /api/chat         ─┐                            │   │
│  │  POST /api/chat/index    ├─> Chatbot Endpoints       │   │
│  │  GET  /api/chat/stats    │                            │   │
│  │  GET  /api/chat/health  ─┘                            │   │
│  └────────────────────────────────────────────────────────┘   │
│                              │                                 │
│                              ▼                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │          RAG Service (app/services/rag/)               │   │
│  │                                                        │   │
│  │  ┌──────────────────────────────────────────────┐     │   │
│  │  │  chatbot.py - Main RAG Logic                │     │   │
│  │  │                                              │     │   │
│  │  │  • Chat orchestration                        │     │   │
│  │  │  • Context retrieval                         │     │   │
│  │  │  • Response generation                       │     │   │
│  │  └───────────┬──────────────────────────────────┘     │   │
│  │              │                                         │   │
│  │              ├───> document_processor.py               │   │
│  │              │     • Extract code files               │   │
│  │              │     • Parse configurations             │   │
│  │              │     • Process documentation            │   │
│  │              │                                         │   │
│  │              └───> vector_db.py                       │   │
│  │                    • Qdrant client                    │   │
│  │                    • Vector storage                   │   │
│  │                    • Semantic search                  │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐        ┌──────────────────────┐      │
│  │   Gemini API         │        │   Sentence Trans.    │      │
│  │   (Google)           │        │   (HuggingFace)      │      │
│  │                      │        │                      │      │
│  │  • LLM for responses │        │  • Text embeddings   │      │
│  │  • 32K context       │        │  • 384-dim vectors   │      │
│  │  • Free 60 req/min   │        │  • Fast inference    │      │
│  └──────────────────────┘        └──────────────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Diagram

```
┌──────────────┐
│ User Types:  │
│ "How does    │
│  BraTS work?"│
└──────┬───────┘
       │
       ▼
┌────────────────────────┐
│  Frontend Chat UI      │
│  • Add to history      │
│  • Show loading        │
└──────┬─────────────────┘
       │
       │ HTTP POST
       ▼
┌────────────────────────────────────┐
│  Backend: /api/chat                │
│  • Validate request                │
│  • Extract query                   │
└──────┬─────────────────────────────┘
       │
       ▼
┌────────────────────────────────────┐
│  RAG Service: chat()               │
│  • Get query embedding             │
└──────┬─────────────────────────────┘
       │
       ▼
┌────────────────────────────────────┐
│  Sentence Transformers             │
│  query → [0.23, -0.45, 0.12, ...]  │
│  (384-dimensional vector)          │
└──────┬─────────────────────────────┘
       │
       ▼
┌────────────────────────────────────┐
│  Qdrant Vector DB                  │
│  • Semantic search                 │
│  • Return top-5 documents          │
│  • With similarity scores          │
└──────┬─────────────────────────────┘
       │
       │ Retrieved: 5 documents
       ▼
┌────────────────────────────────────┐
│  RAG Service: generate_response()  │
│  • Build context from docs         │
│  • Add chat history                │
│  • Create prompt                   │
└──────┬─────────────────────────────┘
       │
       │ Prompt with context
       ▼
┌────────────────────────────────────┐
│  Gemini API                        │
│  • Process prompt + context        │
│  • Generate response               │
│  • ~2 seconds                      │
└──────┬─────────────────────────────┘
       │
       │ AI Response
       ▼
┌────────────────────────────────────┐
│  RAG Service: format response      │
│  • Combine response + sources      │
│  • Return to API                   │
└──────┬─────────────────────────────┘
       │
       │ JSON Response
       ▼
┌────────────────────────────────────┐
│  Frontend: Display                 │
│  • Show message                    │
│  • List sources                    │
│  • Update history                  │
└────────────────────────────────────┘
```

## 📚 Knowledge Base Structure

```
┌─────────────────────────────────────────────────────────┐
│              INDEXED KNOWLEDGE BASE                      │
│              ~150 Document Chunks                        │
└─────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │ Backend │    │Frontend │    │  MONAI  │
    │  Code   │    │  Code   │    │ Bundles │
    └─────────┘    └─────────┘    └─────────┘
         │               │               │
    ┌────┴────┐     ┌────┴────┐     ┌────┴────┐
    │         │     │         │     │         │
    ▼         ▼     ▼         ▼     ▼         ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│Routes│ │Serv. │ │Comp. │ │Utils │ │Conf. │ │ Docs │
│      │ │      │ │      │ │      │ │      │ │      │
│ • mo │ │ • in │ │ •App │ │ •CSS │ │ •met │ │ •REA │
│ dels │ │ fere │ │      │ │      │ │ adat │ │ DME  │
│      │ │ nce  │ │ • Co │ │      │ │ a    │ │      │
│ • se │ │      │ │ mpnt │ │      │ │      │ │      │
│ gmen │ │ • st │ │      │ │      │ │ • in │ │      │
│ t    │ │ orag │ │      │ │      │ │ fer  │ │      │
│      │ │ e    │ │      │ │      │ │      │ │      │
│ • up │ │      │ │      │ │      │ │      │ │      │
│ load │ │ • re │ │      │ │      │ │      │ │      │
│      │ │ gist │ │      │ │      │ │      │ │      │
│      │ │ ry   │ │      │ │      │ │      │ │      │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘

Example Documents:
• "backend/app/api/routes/segment.py" - Code file
• "models/bundles/brats_mri_segmentation/configs/metadata.json" - Config
• "README.md - Section: MVP Workflow" - Documentation chunk
• "MONAI Bundle: brats_mri_segmentation" - Bundle overview
```

## 🎯 Query Processing Example

```
User Query: "How does BraTS model preprocessing work?"

Step 1: Embedding Generation
────────────────────────────
Input: "How does BraTS model preprocessing work?"
Output: [0.23, -0.45, 0.12, 0.67, -0.34, ...] (384 dims)

Step 2: Vector Search
────────────────────────────
Search Qdrant for similar embeddings
Top 5 Results:

1. [Score: 0.87] brats_mri_segmentation/configs/inference.json
   "preprocessing section with transforms pipeline..."

2. [Score: 0.82] backend/app/services/inference.py
   "def run_monai_bundle(...) preprocessing logic..."

3. [Score: 0.79] brats_mri_segmentation/configs/metadata.json
   "image_classes: 4 channel data, T1c, T1, T2, FLAIR..."

4. [Score: 0.75] backend/app/services/rag/document_processor.py
   "Extract JSON configuration files..."

5. [Score: 0.71] README.md
   "Models in this project are MONAI bundles..."

Step 3: Context Building
────────────────────────────
Combine retrieved documents:

[Source: .../configs/inference.json]
{
  "preprocessing": {
    "transforms": [
      {"_target_": "LoadImaged"},
      {"_target_": "EnsureChannelFirstd"},
      {"_target_": "Spacingd"},
      ...
    ]
  }
}

[Source: .../inference.py]
def run_monai_bundle(...):
    # Preprocessing handled by bundle config
    bundle_scripts.run(...)
...

Step 4: Prompt Creation
────────────────────────────
You are an AI assistant for Corpus Medica...

RETRIEVED CONTEXT:
[Source: .../inference.json]
{preprocessing config...}

[Source: .../inference.py]
{code snippet...}

USER QUESTION: How does BraTS model preprocessing work?

ASSISTANT RESPONSE:

Step 5: Gemini API Call
────────────────────────────
Send prompt → Gemini processes → Returns response

Step 6: Response Formatting
────────────────────────────
{
  "response": "BraTS preprocessing involves several steps:
               1. Loading multi-modal MRI data (T1, T1ce, T2, FLAIR)
               2. Channel-first conversion
               3. Spatial resampling to 1x1x1mm
               4. Intensity normalization
               ...",
  "sources": [
    {
      "source": "models/bundles/brats.../inference.json",
      "type": "json_config",
      "score": 0.87
    },
    ...
  ]
}

Step 7: UI Display
────────────────────────────
┌────────────────────────────────────┐
│ 🤖 Assistant                       │
│                                    │
│ BraTS preprocessing involves...    │
│                                    │
│ 📚 3 sources [click to expand]     │
│   └─> ✓ inference.json (87%)      │
│       ✓ inference.py (82%)         │
│       ✓ metadata.json (79%)        │
└────────────────────────────────────┘
```

## 🎨 Frontend UI Structure

```
┌──────────────────────────────────────────────────────────┐
│ Main Application (App.tsx)                               │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Hero Section                                         │ │
│ │                                                      │ │
│ │ MedAI Platform                                       │ │
│ │ [Workflow][Jobs][💬 Ask AI Assistant] ← Button!     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Original Features                                    │ │
│ │ • Model Selection                                    │ │
│ │ • File Upload                                        │ │
│ │ • Segmentation                                       │ │
│ │ • Results                                            │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
                                    │
                                    │ Click Button
                                    ▼
         ┌──────────────────────────────────────┐
         │ Chat Sidebar (slides from right)     │
         │                                      │
         │ ┌──────────────────────────────────┐ │
         │ │ 🤖 AI Assistant                  │ │
         │ │ Corpus Medica Knowledge Base     │ │
         │ │                        [Close ✕] │ │
         │ └──────────────────────────────────┘ │
         │                                      │
         │ ┌──────────────────────────────────┐ │
         │ │ Message List (scrollable)        │ │
         │ │                                  │ │
         │ │ 🤖: Welcome! I can help...       │ │
         │ │                                  │ │
         │ │ 👤: How does BraTS work?         │ │
         │ │                                  │ │
         │ │ 🤖: BraTS is a model for...      │ │
         │ │     📚 3 sources                 │ │
         │ │                                  │ │
         │ └──────────────────────────────────┘ │
         │                                      │
         │ ┌──────────────────────────────────┐ │
         │ │ Suggested Questions              │ │
         │ │ • How does MONAI work?           │ │
         │ │ • Explain BraTS architecture     │ │
         │ └──────────────────────────────────┘ │
         │                                      │
         │ ┌──────────────────────────────────┐ │
         │ │ [Type your question...] [Send ➤] │ │
         │ └──────────────────────────────────┘ │
         │                                      │
         └──────────────────────────────────────┘
```

## 🚀 Deployment Architecture

```
Development Mode (Local):
┌────────────────────────────────────────┐
│ localhost:5173 (Frontend)              │
│ • npm run dev                          │
│ • Hot reload                           │
└──────────┬─────────────────────────────┘
           │
           │ API calls
           ▼
┌────────────────────────────────────────┐
│ localhost:8000 (Backend)               │
│ • uvicorn main:app --reload            │
│ • In-memory Qdrant                     │
│ • Auto-indexing                        │
└────────────────────────────────────────┘

Production Mode (Docker):
┌────────────────────────────────────────┐
│ Frontend Container                     │
│ • nginx:alpine                         │
│ • Built static files                   │
└──────────┬─────────────────────────────┘
           │
           │ Reverse proxy
           ▼
┌────────────────────────────────────────┐
│ Backend Container                      │
│ • Python 3.11                          │
│ • Persistent Qdrant (/data/qdrant)    │
│ • Gunicorn + Uvicorn workers           │
└──────────┬─────────────────────────────┘
           │
           │ External APIs
           ▼
┌────────────────────────────────────────┐
│ Gemini API (Google Cloud)              │
│ • Model: gemini-pro                    │
│ • Rate: 60 req/min (free tier)         │
└────────────────────────────────────────┘
```

## 📂 File Organization Map

```
CorpusMedica/
│
├── backend/                    ← BACKEND CODE
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── chatbot.py       ← NEW! Chat API
│   │   │       ├── models.py
│   │   │       ├── segment.py
│   │   │       └── uploads.py
│   │   │
│   │   ├── services/
│   │   │   ├── rag/                 ← NEW! RAG Service
│   │   │   │   ├── __init__.py
│   │   │   │   ├── chatbot.py       ← Main logic
│   │   │   │   ├── document_processor.py
│   │   │   │   └── vector_db.py
│   │   │   │
│   │   │   ├── inference.py
│   │   │   └── models_registry.py
│   │   │
│   │   └── core/
│   │       └── logging.py
│   │
│   ├── main.py                      ← UPDATED!
│   ├── requirements.txt             ← UPDATED!
│   ├── test_chatbot.py              ← NEW! Testing
│   └── init_chatbot.py              ← NEW! Setup
│
├── frontend/                   ← FRONTEND CODE
│   └── src/
│       ├── components/              ← NEW! Components
│       │   ├── ChatSidebar.tsx      ← Chat UI
│       │   └── ChatSidebar.css      ← Styling
│       │
│       ├── App.tsx                  ← TO UPDATE
│       ├── App-Updated.tsx.example  ← NEW! Reference
│       └── App.css
│
├── models/                     ← MODEL BUNDLES
│   └── bundles/
│       ├── brats_mri_segmentation/
│       │   ├── configs/
│       │   │   ├── metadata.json    ← Indexed
│       │   │   └── inference.json   ← Indexed
│       │   └── docs/
│       │       └── README.md        ← Indexed
│       │
│       └── spleen_ct_segmentation/
│           └── ... (same structure)
│
├── .env.example                ← UPDATED!
├── README.md                   ← Original docs
│
└── NEW DOCS:
    ├── CHATBOT_README.md       ← Quick start (5 min)
    ├── CHATBOT_SETUP.md        ← Complete guide
    ├── INTEGRATION_CHECKLIST.md
    ├── IMPLEMENTATION_SUMMARY.md
    └── VISUAL_ARCHITECTURE.md  ← This file
```

---

**Ready to build? Follow CHATBOT_README.md for 5-minute setup!** 🚀
