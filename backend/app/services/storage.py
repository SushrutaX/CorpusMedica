import os
from pathlib import Path
from typing import Iterable, Tuple
from uuid import uuid4

def ensure_dir(path: str):
    Path(path).mkdir(parents=True, exist_ok=True)

def _safe_filename(filename: str) -> str:
    safe_name = filename.replace("..", "").replace("/", "_").replace("\\", "_")
    return safe_name or f"upload_{uuid4().hex}"

def save_upload(upload_dir: str, filename: str, file_bytes: bytes) -> str:
    ensure_dir(upload_dir)
    safe_name = _safe_filename(filename)
    out_path = os.path.join(upload_dir, safe_name)
    with open(out_path, "wb") as f:
        f.write(file_bytes)
    return out_path

def save_uploads_batch(
    upload_dir: str,
    files: Iterable[Tuple[str, bytes]],
) -> str:
    ensure_dir(upload_dir)
    batch_dir = Path(upload_dir) / f"batch_{uuid4().hex}"
    ensure_dir(str(batch_dir))

    used_names = set()
    for filename, file_bytes in files:
        safe_name = _safe_filename(filename)
        candidate = safe_name
        index = 1
        while candidate in used_names:
            stem, suffix = os.path.splitext(safe_name)
            candidate = f"{stem}_{index}{suffix}"
            index += 1
        used_names.add(candidate)
        out_path = batch_dir / candidate
        with out_path.open("wb") as handle:
            handle.write(file_bytes)

    return str(batch_dir)
