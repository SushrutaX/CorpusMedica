# Deployment and Ops

## Docker services
- `backend`: FastAPI + MONAI + PyTorch
- `auth`: Django auth service
- `postgres`: auth database
- `frontend`: optional Dockerized UI

## CPU and GPU builds
CPU:
```
docker compose up --build
```

GPU:
```
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

## Data persistence
- Uploads and outputs are stored on local volumes
- Model bundles can be stored in `models/bundles`
- Chroma index is stored under `backend/chroma_db` or `backend/chroma_storage`

## Chatbot configuration
- `GEMINI_API_KEY` is required for RAG responses.
- Optional `CHROMA_PATH` to move the index to a different volume.

## Environment files
- `.env` for auth and backend settings
- `frontend/.env` for API base URLs

## Monitoring
Check logs:
```
docker compose logs -f backend
```
