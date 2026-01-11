from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.auth import JWTAuthMiddleware
from app.core.logging import setup_logging
from app.api.routes.health import router as health_router
from app.api.routes.files import router as files_router
from app.api.routes.models import router as models_router
from app.api.routes.segment import router as segment_router
from app.api.routes.uploads import router as uploads_router
from app.api.routes.reports import router as reports_router

setup_logging()

app = FastAPI(title="MedAI Platform API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    JWTAuthMiddleware,
    exempt_paths=[
        "/api/health",
        "/docs",
        "/openapi.json",
    ],
)

app.include_router(health_router, prefix="/api")
app.include_router(files_router, prefix="/api")
app.include_router(models_router, prefix="/api")
app.include_router(segment_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
