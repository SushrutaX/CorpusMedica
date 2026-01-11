from fastapi import APIRouter

from config import settings
from app.services.models_registry import list_models as list_registry_models

router = APIRouter()

@router.get("/models")
def list_models():
    return {"models": list_registry_models(settings.models_dir)}
