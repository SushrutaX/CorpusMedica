# Backend API Reference

All routes are mounted under `/api`.

## Authentication
Most endpoints require a Bearer token:

```
Authorization: Bearer <access_token>
```

The following are exempt:
- `/api/health`
- `/api/chat`, `/api/chat/health`, `/api/chat/stats`
- `/docs`, `/openapi.json`

## Health
### GET /api/health
Returns service status.

## Models
### GET /api/models
Returns available models and metadata.

Sample response:
```json
{
  "models": [
    {
      "id": "brats_mri_segmentation",
      "name": "BraTS MRI Segmentation",
      "task": "brain_tumor_segmentation",
      "modality": "MRI",
      "available": true
    }
  ]
}
```

## Uploads
### POST /api/uploads
Upload a single file. Returns a saved path.

### POST /api/uploads/batch
Upload multiple files (NIfTI or DICOM only). Returns a combined path.

### GET /api/uploads/preview
Inspect the upload path and return file metadata.

### GET /api/uploads/volume-info
Returns `shape`, `channels`, and `zooms` for a volume.

### GET /api/uploads/volume-file
Returns a NIfTI volume for the selected channel.

Query params:
- `path` (required)
- `channel` (default 0)

### GET /api/uploads/slice
Returns a PNG slice.

Query params:
- `path` (required)
- `axis` (axial, coronal, sagittal)
- `index`
- `channel`
- `colormap`

### GET /api/uploads/mesh
Returns a PLY mesh from a volume.

Query params:
- `path` (required)
- `channel`
- `iso`
- `step`
- `label` (optional)

## Segmentation
### POST /api/segment
Starts a segmentation job.

Request:
```json
{ "saved_path": "/data/uploads/scan.nii.gz", "model_id": "brats_mri_segmentation" }
```

### GET /api/results/{job_id}
Returns status, metrics, and outputs.

### GET /api/jobs
Returns recent job history.

## Downloads
### GET /api/download
Downloads an output file by path.

## Report analysis
### POST /api/reports/analyze
Analyzes a report file or raw text payload.

## Chatbot (Gemini RAG)
### POST /api/chat
Ask a RAG question. This endpoint always returns a JSON payload, even when the chatbot is not configured.

Request:
```json
{
  "query": "How does BraTS preprocessing work?",
  "history": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi"}
  ],
  "top_k": 4
}
```

Response:
```json
{
  "response": "Answer: ...
Steps: ...
Notes: ...
Sources: ...",
  "sources": [
    {"source": "backend/app/services/inference.py", "type": "python_code", "score": 0.84}
  ]
}
```

Notes:
- `top_k` is validated between 1 and 8, but the RAG layer clamps to 4 (`MAX_TOP_K`).
- Only the last 4 messages are used in the prompt (`MAX_HISTORY_MESSAGES`).
- If `GEMINI_API_KEY` is missing, a configuration message is returned with empty `sources`.
- If the RAG service cannot import, a fallback message is returned (also with empty `sources`).

### GET /api/chat/health
Returns config status and index state.

Example response:
```json
{
  "chatbot_enabled": true,
  "api_key_configured": true,
  "rag_service": "available",
  "knowledge_base_indexed": true,
  "documents_count": 120
}
```

Notes:
- `rag_service` can be `available`, `not_installed`, or `error: <message>`.
- `knowledge_base_indexed` and `documents_count` appear only when the RAG service is available.

### GET /api/chat/stats
Returns collection stats:
```json
{
  "indexed": true,
  "documents_count": 120,
  "collection_name": "corpus_medica_docs",
  "status": "ready"
}
```
