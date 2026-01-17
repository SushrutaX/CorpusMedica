# Getting Started

This guide gets the platform running locally for development or demo use.

## Prerequisites
- Docker Desktop (recommended for backend and auth service)
- Node.js 18+ (for frontend local dev)
- Python 3.11 (only if you run the backend outside Docker)

## Repo layout
- `backend/`: FastAPI API + MONAI inference
- `frontend/`: React UI
- `auth_service/`: Django auth service
- `models/`: MONAI bundles and weights

## Quick start (CPU)
From the repo root:

```
docker compose up --build
```

Services:
- Backend API: http://localhost:8000
- Auth service: http://localhost:9000
- Frontend (if running in Docker): http://localhost:5173

## GPU build (optional)
If you have a supported NVIDIA GPU:

```
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

## Run frontend locally (recommended)
From `frontend/`:

```
npm install
npm run dev
```

Set `frontend/.env` to point to the backend and auth service:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_AUTH_BASE_URL=http://localhost:9000
VITE_AUTH_REQUIRED=true
```

## Auth service settings
Create `.env` from `.env.example` and add SMTP credentials:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=your@email
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

## Model bundles
If weights are not present in `/models/bundles`, download them once:

```
docker compose exec backend python scripts/download_monai_bundles.py
```

## Common issues
- 401s from backend: ensure auth is enabled and you are logged in.
- Slow first chat response: initial indexing may take a few minutes.
- GPU errors: use the CPU build or reduce ROI size in the model config.
