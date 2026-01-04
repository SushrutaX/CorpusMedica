from fastapi import APIRouter, UploadFile, File
from config import settings
from app.services.storage import save_upload

router = APIRouter()

@router.post("/uploads")
async def upload_scan(file: UploadFile = File(...)):
    data = await file.read()
    path = save_upload(settings.upload_dir, file.filename, data)
    return {"filename": file.filename, "saved_path": path}
