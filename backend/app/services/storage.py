import os
from pathlib import Path

def ensure_dir(path: str):
    Path(path).mkdir(parents=True, exist_ok=True)

def save_upload(upload_dir: str, filename: str, file_bytes: bytes) -> str:
    ensure_dir(upload_dir)
    safe_name = filename.replace("..", "").replace("/", "_").replace("\\", "_")
    out_path = os.path.join(upload_dir, safe_name)
    with open(out_path, "wb") as f:
        f.write(file_bytes)
    return out_path
