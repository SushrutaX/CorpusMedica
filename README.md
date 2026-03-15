# Corpus Medica — Medical AI Platform

An open-source, modular medical AI platform for clinicians and researchers. Upload imaging studies or lab reports, run AI-powered analysis, and inspect results through a modern, multi-page UI. The platform is model-agnostic and ships a working pipeline using MONAI pretrained bundles, a lab report analysis engine, an RAG-powered AI chatbot, a 3D anatomy viewer, and a full authentication system.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Services & Containers](#3-services--containers)
4. [Running the Project](#4-running-the-project)
5. [Environment Variables](#5-environment-variables)
6. [Authentication System](#6-authentication-system)
7. [Medical Imaging — Segmentation Pipeline](#7-medical-imaging--segmentation-pipeline)
8. [Lab Report Analysis](#8-lab-report-analysis)
9. [RAG AI Chatbot](#9-rag-ai-chatbot)
10. [3D Anatomy Viewer (WebGL)](#10-3d-anatomy-viewer-webgl)
11. [Frontend Pages & Components](#11-frontend-pages--components)
12. [Full API Reference](#12-full-api-reference)
13. [File & Directory Map](#13-file--directory-map)
14. [GPU & CPU Support](#14-gpu--cpu-support)
15. [Model Registry & Bundle Discovery](#15-model-registry--bundle-discovery)
16. [Inference Pipeline (Detailed)](#16-inference-pipeline-detailed)
17. [Data Formats & Storage](#17-data-formats--storage)
18. [Common Errors & Fixes](#18-common-errors--fixes)
19. [Security & Compliance Notes](#19-security--compliance-notes)
20. [Roadmap](#20-roadmap)
21. [License](#21-license)

---

## 1. Platform Overview

Corpus Medica has grown from a single-page segmentation MVP into a multi-module clinical AI platform. The five core pillars are:

| Module | Description |
|---|---|
| **Medical Imaging** | Upload NIfTI/DICOM scans, run MONAI segmentation, download masks |
| **Lab Report Analysis** | Upload PDF/image lab reports, get AI-powered risk analysis with 10 clinical features |
| **RAG Chatbot** | Ask questions about the codebase, MONAI bundles, and medical imaging theory |
| **3D Anatomy Viewer** | Explore anatomy interactively via a Unity WebGL build |
| **Authentication** | JWT-based login, email verification, and password reset via a Django auth service |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (React + Vite + TS)            │
│  Pages: Workspace | Report Analysis | Anatomy | Docs     │
│  Components: ChatSidebar | ChatPanel | ProfileCard       │
└────────────┬───────────────────────────┬────────────────┘
             │ REST (localhost:8000)      │ REST (localhost:8001)
             ▼                           ▼
┌────────────────────┐        ┌──────────────────────────┐
│  Backend (FastAPI) │        │  Auth Service (Django)   │
│  - Segmentation    │        │  - JWT login/refresh     │
│  - Lab Reports     │        │  - Email verification    │
│  - RAG Chatbot     │        │  - Password reset        │
│  - File Downloads  │        │  - Postgres DB           │
└──────┬─────────────┘        └──────────────────────────┘
       │
       ├── /data/uploads, /data/outputs, /data/tmp
       ├── /models/bundles  (MONAI weights)
       ├── Qdrant (vector DB for chatbot)
       └── ChromaDB / file-based report storage
```

---

## 3. Services & Containers

| Service | Image / Build | Port | Notes |
|---|---|---|---|
| `frontend` | `frontend/Dockerfile` | 5173 | Vite dev server |
| `backend` | `backend/Dockerfile` | 8000 | FastAPI + MONAI |
| `backend-gpu` | `backend/Dockerfile.gpu` | 8000 | GPU override |
| `auth_service` | `auth_service/Dockerfile` | 8001 | Django + Postgres |

All services are orchestrated via `docker-compose.yml`. GPU support is layered via `docker-compose.gpu.yml`.

---

## 4. Running the Project

### CPU (default)
```bash
docker compose up --build
```

### GPU
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

### Manual (no Docker)
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Auth service
cd auth_service
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8001

# Frontend
cd frontend
npm install
npm run dev
```

### Service URLs
| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Backend API Docs | http://localhost:8000/docs |
| Auth Service | http://localhost:8001 |

### Downloading MONAI Bundles
```bash
# Download all recommended bundles
docker compose exec backend python scripts/download_monai_bundles.py

# List available bundles
docker compose exec backend python scripts/download_monai_bundles.py --list

# Download specific bundles
docker compose exec backend python scripts/download_monai_bundles.py brats_mri_segmentation spleen_ct_segmentation
```

---

## 5. Environment Variables

### Root `.env` (copied from `.env.example`)
| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for the RAG chatbot |
| `SMTP_HOST` | SMTP host for auth email delivery |
| `SMTP_PORT` | SMTP port (e.g. 587 for TLS) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password (use app password for Gmail) |
| `SMTP_FROM_EMAIL` | From address for verification/reset emails |
| `SMTP_USE_TLS` | `true` for Gmail |
| `SMTP_USE_SSL` | `false` for Gmail with TLS |

### Frontend `frontend/.env`
| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL |
| `VITE_AUTH_BASE_URL` | Auth service base URL |
| `VITE_AUTH_REQUIRED` | `true` to enforce login before app access |

> **Never commit `.env` files.** Both `.env` and `*.env` are already in `.gitignore`.

---

## 6. Authentication System

Authentication is handled by a standalone Django service (`auth_service/`) running in its own container with a Postgres database.

### Stack
- Django + Django REST Framework
- `djangorestframework-simplejwt` for JWT tokens
- OTP-based email verification and password reset
- SMTP delivery (Gmail or any provider)

### Auth Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/token/` | Login — returns access + refresh tokens |
| `GET` | `/api/me/` | Session check — validates stored token |
| `POST` | `/api/email/verify/request/` | Send OTP verification email |
| `POST` | `/api/email/verify/confirm/` | Confirm email with OTP |
| `POST` | `/api/password/forgot/` | Send password reset OTP |
| `POST` | `/api/password/reset/` | Reset password with OTP |

### Auth Flows

**App Boot:**
1. App loads → checks for stored access token.
2. Calls `/api/me/` to validate token.
3. Valid → user enters app. Invalid → redirect to login.

**Login:**
1. User submits username or email + password.
2. Auth service resolves email → username if needed.
3. Blocks login if email is not verified.
4. Returns `access` + `refresh` tokens on success.

**Email Verification:**
1. Frontend calls `/api/email/verify/request/`.
2. Auth service generates and emails an OTP.
3. User submits OTP to `/api/email/verify/confirm/`.
4. Auth marks email as verified.

**Forgot Password:**
1. Frontend calls `/api/password/forgot/` with identifier.
2. Auth emails OTP (only if email is verified).
3. User submits OTP + new password to `/api/password/reset/`.

### Admin
Django admin shows per-user `Email verified` (boolean) and `Verified at` (timestamp) fields.

---

## 7. Medical Imaging — Segmentation Pipeline

### MVP Workflow
1. Upload a medical scan (NIfTI or zipped DICOM).
2. Select a segmentation model from the model list.
3. Click "Run Segmentation" to create a job.
4. Backend returns a `job_id` and starts processing in a background thread.
5. Frontend polls job status: `queued → running → done`.
6. Completed job returns metrics and download links for the output mask.

### Segmentation API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/models` | List available models |
| `POST` | `/api/uploads` | Upload scan file |
| `POST` | `/api/segment` | Start segmentation job |
| `GET` | `/api/results/{job_id}` | Poll job status and results |
| `GET` | `/api/download?path=...` | Download output file |

### Segmentation API Examples

**GET /api/models**
```json
{
  "models": [{
    "id": "brats_mri_segmentation",
    "name": "BraTS MRI Segmentation",
    "type": "segmentation",
    "task": "brain_tumor_segmentation",
    "modality": "MRI",
    "input": ["nifti_multi", "dicom_zip"],
    "description": "BraTS brain tumor segmentation (multi-modal MRI).",
    "available": true
  }]
}
```

**POST /api/segment**
```json
// Request
{ "saved_path": "/data/uploads/case.nii.gz", "model_id": "brats_mri_segmentation" }

// Response
{ "job_id": "uuid" }
```

**GET /api/results/{job_id}**
```json
{
  "job_id": "uuid",
  "status": "queued|running|done|error",
  "model_id": "brats_mri_segmentation",
  "metrics": { "tumor_volume_cm3": 12.3 },
  "outputs": {
    "mask_path": "/data/outputs/<job_id>/mask.nii.gz",
    "report_path": "/data/outputs/<job_id>/report.json"
  },
  "error_message": null
}
```

### Outputs
- `mask.nii.gz` — segmentation mask at the same resolution as the input
- `report.json` — job metadata + computed metrics

Default metric: `tumor_volume_cm3 = mask_voxels × voxel_volume_mm³ / 1000`

> This is a placeholder metric and not a clinical measurement.

---

## 8. Lab Report Analysis

### Overview
Upload a PDF, image (JPG/PNG), or plain-text lab report. The backend extracts values via OCR or PDF parsing and runs **10 clinical analysis features**, returning a structured JSON response displayed across the frontend report page.

### Supported Upload Formats
- PDF (`.pdf`)
- Images (`.jpg`, `.jpeg`, `.png`)
- Plain text (`.txt`)

### 10 Analysis Features

| # | Feature | Service File |
|---|---|---|
| 1 | **Personalized Reference Ranges** | `reference_ranges.py` |
| 2 | **Analysis Confidence Scoring** | `confidence_scorer.py` |
| 3 | **Abnormality Prioritization** | `abnormality_prioritizer.py` |
| 4 | **Pattern-Based Risk Clusters** | `risk_clusters.py` |
| 5 | **Trend Analysis Over Time** | `trend_analysis.py` + `report_storage.py` |
| 6 | **Doctor Discussion Prompts** | `doctor_prompts.py` |
| 7 | **Report ↔ Imaging Correlation** | `imaging_correlation.py` |
| 8 | **Procedure & Surgical Risk Flags** | `procedure_risk.py` |
| 9 | **Digital Twin Inputs** | `digital_twin.py` |
| 10 | **Population-Level Insights** | `population_insights.py` |

### Feature Details

**1. Personalized Reference Ranges**
Adjusts normal ranges based on patient demographics passed as optional parameters:
- Age-adjusted ranges (pediatric vs. adult)
- Sex-specific ranges (e.g., hemoglobin, HDL cholesterol)
- Fasting-status-aware ranges (glucose, triglycerides)
- Supports 12+ common lab tests

**2. Analysis Confidence Scoring**
Scores the reliability of the extraction:
- OCR quality assessment for image-based reports
- Data completeness (tests found vs. expected)
- Value plausibility checks to catch OCR artifacts
- Returns a 0–1 confidence score with level (`high`, `medium`, `low`, `very_low`) and actionable recommendations

**3. Abnormality Prioritization**
Ranks abnormal values by clinical urgency:
- Clinical importance scores (0–100)
- Urgency categories: `critical`, `high`, `moderate`, `low`
- Severity multipliers for extreme deviations
- Returns top-5 priorities with a summary

**4. Pattern-Based Risk Clusters**
Detects 11+ multi-marker clinical patterns:
- Metabolic syndrome, diabetes risk, cardiovascular risk
- Kidney dysfunction, anemia, liver dysfunction
- Thyroid dysfunction, Vitamin D deficiency
- Acute emergencies (severe hypo/hyperglycemia, severe anemia)
- Partial pattern matching at 50%+ threshold

**5. Trend Analysis Over Time**
Compares current report to historical reports stored for a patient:
- Tracks values as improving / worsening / stable
- Requires `patient_id` and prior stored reports
- Storage layer: file-based under `backend/data/reports/`

**6. Doctor Discussion Prompts**
Generates safe, non-prescriptive discussion questions:
- Categorized: critical questions, high-priority, general, follow-up
- Context-aware: driven by abnormalities, clusters, confidence, and prioritization
- Includes guidance on urgency of seeking care

**7. Report ↔ Imaging Correlation**
Links lab findings to imaging study results:
- Correlates labs with segmentation job outputs (e.g., elevated creatinine + kidney scan)
- Currently uses structured placeholder; extend by passing imaging `job_id`

**8. Procedure & Surgical Risk Flags**
Assesses pre-operative and procedural risks:
- Flags anesthesia risk factors (e.g., elevated creatinine, coagulation issues)
- Returns risk level and recommended pre-procedure checks

**9. Digital Twin Inputs**
Formats lab values for downstream simulation models:
- Exports in JSON and FHIR-compatible format
- Downloadable from the frontend results panel

**10. Population-Level Insights**
Aggregates anonymized data for research:
- Statistical summaries across stored reports
- Requires multiple reports to be meaningful

### Lab Report API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/reports/analyze` | Analyze a report — main endpoint |
| `GET` | `/api/reports/trends/{patient_id}` | Trend analysis for a patient |
| `GET` | `/api/reports/population-insights` | Aggregate population statistics |
| `GET` | `/api/reports/{report_id}/digital-twin` | Export in digital twin format |

**POST /api/reports/analyze — Optional parameters:**
```json
{
  "age_years": 45,
  "sex": "male",
  "fasting_status": true,
  "expected_tests": ["glucose", "hemoglobin", "creatinine"]
}
```

**POST /api/reports/analyze — Response structure:**
```json
{
  "extracted_data": { "lab_values": {}, "demographics": {} },
  "confidence_analysis": {
    "overall_confidence": 0.85,
    "confidence_level": "high",
    "issues": [],
    "recommendations": []
  },
  "risk_analysis": {
    "risk_level": "high",
    "prioritized_abnormalities": [],
    "priority_summary": {},
    "risk_clusters": { "detected_clusters": [], "overall_cluster_risk": "high" },
    "personalized_context": {}
  },
  "llm_explanation": "...",
  "doctor_discussion_prompts": {
    "prompts": {
      "critical_questions": [],
      "high_priority_questions": [],
      "general_questions": [],
      "follow_up_questions": []
    },
    "guidance": "..."
  }
}
```

---

## 9. RAG AI Chatbot

### Overview
An AI assistant embedded in the frontend that answers questions about the codebase, MONAI bundle internals, and general medical imaging theory. It uses Retrieval-Augmented Generation (RAG): the full codebase and documentation are indexed into a vector database, and relevant chunks are retrieved to ground each Gemini API response.

### Stack
- **LLM:** Google Gemini API (`gemini-1.5-flash` / configurable)
- **Vector DB:** Qdrant (`backend/qdrant_storage/`)
- **Embeddings:** Sentence Transformers (`all-MiniLM-L6-v2`)
- **Orchestration:** LangChain
- **Backend:** FastAPI routes in `backend/app/api/routes/chatbot.py`
- **Frontend:** `ChatSidebar.tsx` + `ChatPanel.tsx`

### Setup (5 minutes)

1. **Get a free Gemini API key:** https://makersuite.google.com/app/apikey
2. **Add to `.env`:**
   ```
   GEMINI_API_KEY=your_actual_key_here
   ```
3. **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
4. **Start the app:**
   ```bash
   docker-compose up --build
   # or manually: uvicorn main:app --reload
   ```
5. **Test via CLI:**
   ```bash
   cd backend
   python test_chatbot.py
   ```

### What Gets Indexed
The chatbot auto-indexes on first startup (~3 minutes) and caches results in Qdrant:
- All `.py` files in `backend/`
- All `.ts` / `.tsx` files in `frontend/src/`
- All markdown docs (`.md`) in the project root
- All MONAI bundle files in `models/bundles/*/` (`.json`, `.md`, `.py`)

### Chatbot API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Send a message and receive a response with sources |
| `POST` | `/api/chat/index` | (Re)index the knowledge base |
| `GET` | `/api/chat/stats` | Index statistics (doc count, status) |
| `GET` | `/api/chat/health` | Chatbot health check |

**POST /api/chat**
```json
// Request
{
  "query": "How does the MONAI bundle inference work?",
  "history": [],
  "top_k": 5
}

// Response
{
  "response": "MONAI bundle inference works by...",
  "sources": [
    { "source": "backend/app/services/inference.py", "type": "python_code", "score": 0.87 }
  ],
  "context_used": 5
}
```

**Manual re-index:**
```bash
curl -X POST http://localhost:8000/api/chat/index \
  -H "Content-Type: application/json" \
  -d '{"force_reindex": true}'
```

### Example Questions
```
How does the MONAI bundle inference work?
Explain the BraTS model architecture.
What preprocessing is done for CT scans?
How do I add a new model to the registry?
What's the difference between the segmentation and report analysis routes?
What inputs does the BraTS model expect?
How does the job polling system work?
```

### Performance
| Operation | Time |
|---|---|
| First-time indexing | ~3 minutes |
| Embedding + search | < 150ms |
| Gemini API call | 1–3 seconds |
| Total response | ~2–4 seconds |

### Cost (Gemini API)
- **Free tier:** 60 requests/minute — sufficient for development
- **Paid tier:** ~$0.05/day for typical usage

---

## 10. 3D Anatomy Viewer (WebGL)

A Unity WebGL build for interactive 3D anatomy exploration is served from the `Anatomy-WebGL/` directory. The frontend loads it in `FemaleAnatomyPage.tsx` via an embedded iframe or direct WebGL loader.

### Files
```
Anatomy-WebGL/
├── index.html           # WebGL entry point
├── Build/               # Unity WebGL build artifacts
├── StreamingAssets/     # Runtime assets
└── TemplateData/        # Unity web template
```

The viewer is accessible from the frontend navigation. No additional setup is needed — assets are served statically.

---

## 11. Frontend Pages & Components

### Pages (`frontend/src/pages/`)

| Page File | Route | Description |
|---|---|---|
| `WorkspacePage.tsx` | `/workspace` | Main imaging workspace — upload, model select, segmentation |
| `ReportAnalysis.tsx` | `/reports` | Lab report upload and 10-feature analysis results |
| `FemaleAnatomyPage.tsx` | `/anatomy` | 3D WebGL anatomy viewer |
| `DocsPage.tsx` | `/docs` | In-app documentation viewer |
| `devPage.tsx` | `/dev` | Developer/debug utilities |

### Components (`frontend/src/components/`)

| Component | Description |
|---|---|
| `ChatSidebar.tsx` | Slide-in chat panel — full RAG chatbot UI with history and source attribution |
| `ChatPanel.tsx` | Alternative embedded chat panel variant |
| `ProfileCard.tsx` | User profile display component (auth-aware) |
| `Prism.tsx` | Code syntax highlighting component |
| `LabMarkerIcon.tsx` | Custom SVG icon for lab report markers |

### UI Features (across the app)
- Hero header with workflow summary
- Model cards with hover and selection states
- Upload dropzone with upload status indicator
- Segmentation timeline, progress bar, and status badges
- Skeleton/shimmer loading states
- Toast notifications for success and failure
- Results panel with download links
- Report analysis dashboard with sections for each of the 10 features
- Digital Twin export download button
- Chat sidebar with animated messages, source attribution, and suggested questions
- Responsive layout with Tailwind CSS

---

## 12. Full API Reference

### Backend (FastAPI — port 8000)

#### Health
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend health check |

#### Models
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/models` | List available MONAI models |

#### Uploads
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/uploads` | Upload a scan or report file |

#### Segmentation
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/segment` | Start a segmentation job |
| `GET` | `/api/results/{job_id}` | Poll job status and results |

#### Files
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/download?path=...` | Download output file (restricted to `/data/outputs`) |

#### Lab Reports
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/reports/analyze` | Full lab report analysis |
| `GET` | `/api/reports/trends/{patient_id}` | Patient trend data |
| `GET` | `/api/reports/population-insights` | Aggregate population stats |
| `GET` | `/api/reports/{report_id}/digital-twin` | Digital twin export |

#### Chatbot
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Chat with the RAG assistant |
| `POST` | `/api/chat/index` | (Re)index knowledge base |
| `GET` | `/api/chat/stats` | Index statistics |
| `GET` | `/api/chat/health` | Chatbot health check |

### Auth Service (Django — port 8001)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/token/` | Login (username or email) |
| `GET` | `/api/me/` | Validate session token |
| `POST` | `/api/email/verify/request/` | Send verification OTP |
| `POST` | `/api/email/verify/confirm/` | Confirm email OTP |
| `POST` | `/api/password/forgot/` | Send password reset OTP |
| `POST` | `/api/password/reset/` | Confirm password reset |

---

## 13. File & Directory Map

```
CorpusMedica/
│
├── backend/
│   ├── main.py                          # FastAPI app, routers, CORS
│   ├── config.py                        # Directory and settings config
│   ├── requirements.txt                 # CPU dependencies
│   ├── requirements.gpu.txt             # GPU (nightly PyTorch)
│   ├── Dockerfile                       # CPU build
│   ├── Dockerfile.gpu                   # GPU build
│   ├── test_chatbot.py                  # CLI test for RAG chatbot
│   ├── reindex_vector_db.py             # Manual re-index script
│   ├── init_chatbot.py                  # Setup diagnostics script
│   ├── qdrant_storage/                  # Persistent Qdrant vector DB
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── health.py
│   │   │   ├── models.py                # Model list endpoint
│   │   │   ├── uploads.py               # File upload endpoint
│   │   │   ├── segment.py               # Segmentation job creation + polling
│   │   │   ├── files.py                 # Output file download
│   │   │   ├── reports.py               # Lab report analysis endpoints
│   │   │   └── chatbot.py               # RAG chatbot endpoints
│   │   └── services/
│   │       ├── inference.py             # MONAI / TorchScript inference pipeline
│   │       ├── models_registry.py       # Model registry and bundle discovery
│   │       ├── report_parser.py         # Lab value extraction + OCR
│   │       ├── report_text_extractor.py # PDF/image text extraction
│   │       ├── risk_engine.py           # Core risk analysis orchestrator
│   │       ├── reference_ranges.py      # Personalized reference ranges
│   │       ├── confidence_scorer.py     # OCR + data completeness scoring
│   │       ├── abnormality_prioritizer.py # Clinical urgency ranking
│   │       ├── risk_clusters.py         # Pattern-based cluster detection
│   │       ├── trend_analysis.py        # Time-series trend comparison
│   │       ├── doctor_prompts.py        # Discussion prompt generation
│   │       ├── imaging_correlation.py   # Lab ↔ imaging correlation
│   │       ├── procedure_risk.py        # Surgical/procedural risk flags
│   │       ├── digital_twin.py          # JSON + FHIR export
│   │       ├── population_insights.py   # Anonymized aggregate stats
│   │       ├── report_storage.py        # File-based report persistence
│   │       ├── groq_explainer.py        # Optional Groq LLM explainer
│   │       ├── unet_brats.py            # Custom U-Net BraTS helper
│   │       └── rag/
│   │           ├── chatbot.py           # RAG core (Gemini + Qdrant)
│   │           └── document_processor.py # Code/doc chunking + indexing
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                      # Root app + routing
│   │   ├── App.css                      # Global styles and animations
│   │   ├── pages/
│   │   │   ├── WorkspacePage.tsx        # Imaging workspace
│   │   │   ├── ReportAnalysis.tsx       # Lab report analysis UI
│   │   │   ├── FemaleAnatomyPage.tsx    # 3D WebGL anatomy viewer
│   │   │   ├── DocsPage.tsx             # Documentation viewer
│   │   │   └── devPage.tsx              # Dev/debug page
│   │   └── components/
│   │       ├── ChatSidebar.tsx          # RAG chat sidebar
│   │       ├── ChatSidebar.css
│   │       ├── ChatPanel.tsx            # Embedded chat panel
│   │       ├── ChatPanel.css
│   │       ├── ProfileCard.tsx          # Auth-aware user card
│   │       ├── Prism.tsx                # Code highlighting
│   │       └── LabMarkerIcon.tsx        # SVG lab icon
│   └── Dockerfile
│
├── auth_service/
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── accounts/                        # Django accounts app
│   └── auth_service/                    # Django project config
│
├── Anatomy-WebGL/
│   ├── index.html                       # WebGL entry point
│   ├── Build/                           # Unity compiled assets
│   └── StreamingAssets/
│
├── models/                              # Gitignored — MONAI bundle weights
│   └── bundles/
│       └── <bundle_id>/
│           ├── models/model.pt
│           └── configs/
│               ├── metadata.json
│               └── inference.json
│
├── scripts/                             # Utility scripts
├── docker-compose.yml                   # Base services
├── docker-compose.gpu.yml               # GPU override
├── .env.example                         # Environment template
└── mkdocs.yml                           # MkDocs configuration
```

---

## 14. GPU & CPU Support

### CPU (default)
Uses `backend/requirements.txt` with `torch==2.2.2+cpu`.

### GPU
Uses `backend/requirements.gpu.txt` (PyTorch nightly CUDA) and `backend/Dockerfile.gpu`.

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

**Verify GPU inside container:**
```bash
docker compose exec backend python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
```

**Memory tuning for BraTS (large ROI):**
```bash
MONAI_ROI_SIZE=128,128,128
```

The backend auto-adjusts ROI size based on available GPU memory. Override with the env variable above if needed.

---

## 15. Model Registry & Bundle Discovery

The model registry merges three sources:
1. Default bundles (BraTS MRI, Spleen CT).
2. Any local bundles discovered under `/models/bundles/*/`.
3. Optional `models/registry.json` for custom entries.

Bundle discovery reads:
- `configs/metadata.json` for name, task, modality, description.
- `configs/inference.json` for expected input channels.

A model is marked `available: true` only when weights exist at `models/bundles/<id>/models/model.pt`.

---

## 16. Inference Pipeline (Detailed)

Two inference runners are supported:

**1. MONAI Bundle** (`runner = "monai_bundle"`)
Uses `monai.bundle.scripts.run` with runtime overrides:
- `bundle_root`, `output_dir`
- datalist injection with the uploaded file(s)
- `device` selection
- `dataloader#num_workers = 0` (avoids multi-process crashes in Docker)
- `checkpointloader#map_location` on CPU

**2. TorchScript** (`runner = "torchscript"`)
Loads a `.pt` TorchScript model and runs direct inference or sliding window inference.

**Input handling:**
- NIfTI (`.nii`, `.nii.gz`) accepted directly.
- DICOM series (folder or `.zip`) converted to NIfTI via `dicom2nifti`.
- Zip files may contain multiple NIfTI files for multi-modal input.

**Multi-modal input (e.g., BraTS — 4 channels):**
- Accepts a single 4-channel NIfTI, or a zip with 4 aligned NIfTI files.
- Validates shape and affine alignment across modalities.
- Stacks modalities into a channel-first tensor for bundle execution.

---

## 17. Data Formats & Storage

### Supported Input Formats
- NIfTI: `.nii`, `.nii.gz`
- DICOM series: directory or `.zip`
- Multi-modal NIfTI: single multi-channel file or zip with multiple files
- Lab reports: `.pdf`, `.jpg`, `.jpeg`, `.png`, `.txt`

### Storage Locations
| Path | Contents |
|---|---|
| `/data/uploads` | Uploaded scan and report files |
| `/data/outputs/<job_id>/` | Segmentation masks and reports |
| `/data/tmp` | Temporary working files |
| `/models/bundles` | MONAI bundle weights (gitignored) |
| `backend/data/reports/` | Stored lab reports for trend analysis |
| `backend/qdrant_storage/` | Persistent Qdrant vector index |

---

## 18. Common Errors & Fixes

**"Model expects 4 channels but got 1"**
→ BraTS requires T1, T1ce, T2, FLAIR. Provide all four modalities.

**"All modalities must share the same shape and voxel grid"**
→ Your input modalities are not co-registered. Align and resample them first.

**"DataLoader worker exited unexpectedly"**
→ Fixed by `num_workers=0` in bundle overrides (already set in the pipeline).

**"CUDA error: no kernel image is available"**
→ Your GPU is newer than the installed PyTorch. Use the GPU build with nightly wheels.

**"CUDA out of memory"**
→ Reduce ROI size via `MONAI_ROI_SIZE=128,128,128` or switch to CPU inference.

**"GEMINI_API_KEY not set"**
→ Check that `.env` is in the project root and contains your key. Restart the backend after adding it.

**"Knowledge base not indexed"**
→ Wait 3–5 minutes on first run, or trigger manually:
```bash
curl -X POST http://localhost:8000/api/chat/index -d '{"force_reindex": true}'
```

**Login blocked — "Email not verified"**
→ Complete email verification via the verification flow before logging in.

**No verification emails arriving**
→ Check SMTP settings in `.env`. Use an app password for Gmail and ensure no spaces in the password string.

---

## 19. Security & Compliance Notes

- This platform is intended for **research and clinical decision support only**. It is **not approved for medical diagnosis**.
- The auth service enforces email verification before login, but no role-based access control is implemented yet.
- The download endpoint is restricted to `/data/outputs` but is otherwise open — do not expose to the public internet without additional auth.
- The chatbot API key is server-side only and is never sent to the frontend.
- **Do not upload PHI (Protected Health Information)** unless running in a fully compliant, access-controlled environment.
- Jobs are stored in-memory only. Restarting the backend clears all job history.

---

## 20. Roadmap

- [ ] Persistent job storage (PostgreSQL or Redis)
- [ ] Role-based access control (admin / clinician / researcher)
- [ ] Real-time population insights dashboard
- [ ] FHIR-compliant report ingestion and export
- [ ] Ground-truth Dice evaluation endpoint
- [ ] Model comparison UI
- [ ] Model registration and registry UI
- [ ] Upgrade report storage to a proper database (PostgreSQL / MongoDB)
- [ ] Rate limiting and monitoring for chatbot and analysis endpoints
- [ ] Integrate imaging correlation with live segmentation job results

---

## 21. License

See `LICENSE`.

---

> **Built with MONAI, FastAPI, React, Gemini, Qdrant, Django, and Unity WebGL.**
