from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from config import settings

router = APIRouter()


@router.get("/download")
def download_file(path: str = Query(..., description="Absolute path to output file.")) -> FileResponse:
    target = Path(path)
    if not target.is_absolute():
        target = Path(settings.outputs_dir) / target

    resolved = target.resolve()
    outputs_root = Path(settings.outputs_dir).resolve()
    try:
        allowed = resolved.is_relative_to(outputs_root)
    except AttributeError:
        allowed = str(resolved).startswith(str(outputs_root))

    if not allowed:
        raise HTTPException(status_code=403, detail="File is outside the outputs directory.")
    if not resolved.is_file():
        raise HTTPException(status_code=404, detail="File not found.")

    return FileResponse(str(resolved), filename=resolved.name)
