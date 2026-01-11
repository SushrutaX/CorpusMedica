import hashlib
import io
import shutil
import tempfile
import time
import zipfile
from pathlib import Path
from threading import Lock
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

import dicom2nifti
import nibabel as nib
import numpy as np
import pydicom
from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse
from PIL import Image
from starlette.background import BackgroundTask

from config import settings
from app.services.storage import save_upload, save_uploads_batch

router = APIRouter()

_CACHE_TTL_SECONDS = 20 * 60
_CACHE_MAX_ENTRIES = 8
_ZIP_CACHE: Dict[str, Tuple[Path, float]] = {}
_DICOM_CACHE: Dict[str, Tuple[Path, float]] = {}
_NIFTI_CACHE: Dict[str, Tuple[Path, float]] = {}
_CACHE_LOCK = Lock()


def _cache_key_for_path(path: Path) -> str:
    stat = path.stat()
    seed = f"{path.resolve()}::{stat.st_size}::{stat.st_mtime_ns}"
    return hashlib.sha1(seed.encode("utf-8")).hexdigest()


def _cache_dir(prefix: str, key: str) -> Path:
    return Path(settings.temp_dir) / f"{prefix}_{key[:12]}"


def _prune_cache(cache: Dict[str, Tuple[Path, float]]) -> None:
    now = time.time()
    expired = [
        (key, entry)
        for key, entry in cache.items()
        if now - entry[1] > _CACHE_TTL_SECONDS or not entry[0].exists()
    ]
    for key, (path, _ts) in expired:
        cache.pop(key, None)
        shutil.rmtree(path, ignore_errors=True)

    if len(cache) <= _CACHE_MAX_ENTRIES:
        return
    oldest = sorted(cache.items(), key=lambda item: item[1][1])[: -_CACHE_MAX_ENTRIES]
    for key, (path, _ts) in oldest:
        cache.pop(key, None)
        shutil.rmtree(path, ignore_errors=True)


def _ensure_zip_extracted(path: Path) -> Path:
    cache_key = _cache_key_for_path(path)
    with _CACHE_LOCK:
        _prune_cache(_ZIP_CACHE)
        entry = _ZIP_CACHE.get(cache_key)
        if entry and entry[0].exists():
            _ZIP_CACHE[cache_key] = (entry[0], time.time())
            temp_dir = entry[0]
        else:
            temp_dir = _cache_dir("zip_cache", cache_key)
            _ZIP_CACHE[cache_key] = (temp_dir, time.time())

    sentinel = temp_dir / ".complete"
    if sentinel.exists():
        return temp_dir

    shutil.rmtree(temp_dir, ignore_errors=True)
    temp_dir.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(path, "r") as archive:
            archive.extractall(temp_dir)
    except (zipfile.BadZipFile, EOFError) as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise ValueError("Zip file is corrupted or incomplete.") from exc

    sentinel.touch()
    return temp_dir


def _ensure_dicom_converted(dicom_root: Path) -> Path:
    cache_key = _cache_key_for_path(dicom_root)
    with _CACHE_LOCK:
        _prune_cache(_DICOM_CACHE)
        entry = _DICOM_CACHE.get(cache_key)
        if entry and entry[0].exists():
            _DICOM_CACHE[cache_key] = (entry[0], time.time())
            temp_dir = entry[0]
        else:
            temp_dir = _cache_dir("dicom_cache", cache_key)
            _DICOM_CACHE[cache_key] = (temp_dir, time.time())

    sentinel = temp_dir / ".complete"
    if sentinel.exists():
        return _find_largest_nifti(temp_dir)

    shutil.rmtree(temp_dir, ignore_errors=True)
    temp_dir.mkdir(parents=True, exist_ok=True)
    nifti_path = _convert_dicom_to_nifti(dicom_root, temp_dir / "nifti")
    sentinel.touch()
    return nifti_path


def _ensure_uncompressed_nifti(path: Path) -> Path:
    if not path.name.lower().endswith(".nii.gz"):
        return path
    cache_key = _cache_key_for_path(path)
    with _CACHE_LOCK:
        _prune_cache(_NIFTI_CACHE)
        entry = _NIFTI_CACHE.get(cache_key)
        if entry and entry[0].exists():
            _NIFTI_CACHE[cache_key] = (entry[0], time.time())
            cached = entry[0]
        else:
            cached = _cache_dir("nifti_cache", cache_key)
            _NIFTI_CACHE[cache_key] = (cached, time.time())

    out_path = cached / "volume.nii"
    sentinel = cached / ".complete"
    if sentinel.exists() and out_path.exists():
        return out_path

    shutil.rmtree(cached, ignore_errors=True)
    cached.mkdir(parents=True, exist_ok=True)
    try:
        image = nib.load(str(path))
        nib.save(image, str(out_path))
    except Exception as exc:
        shutil.rmtree(cached, ignore_errors=True)
        raise ValueError("Failed to prepare volume for fast slicing.") from exc

    sentinel.touch()
    return out_path


def _is_nifti_name(name: str) -> bool:
    lower = name.lower()
    return lower.endswith(".nii") or lower.endswith(".nii.gz")


def _is_zip_name(name: str) -> bool:
    return name.lower().endswith(".zip")


def _looks_like_dicom(data: bytes) -> bool:
    return len(data) > 132 and data[128:132] == b"DICM"


def _infer_file_kind(filename: str, data: bytes) -> str:
    if _is_nifti_name(filename):
        return "nifti"
    if _is_zip_name(filename):
        return "zip"
    if filename.lower().endswith(".dcm") or _looks_like_dicom(data):
        return "dicom"
    return "unknown"


def _resolve_upload_path(path: str) -> Path:
    target = Path(path)
    if not target.is_absolute():
        target = Path(settings.upload_dir) / target
    resolved = target.resolve()
    uploads_root = Path(settings.upload_dir).resolve()
    try:
        allowed = resolved.is_relative_to(uploads_root)
    except AttributeError:
        allowed = str(resolved).startswith(str(uploads_root))
    if not allowed:
        raise HTTPException(status_code=403, detail="Path is outside uploads.")
    if not resolved.exists():
        raise HTTPException(status_code=404, detail="Upload not found.")
    return resolved


def _find_nifti_files(directory: Path) -> List[Path]:
    return sorted(
        list(directory.rglob("*.nii")) + list(directory.rglob("*.nii.gz"))
    )


def _find_largest_nifti(directory: Path) -> Path:
    candidates = _find_nifti_files(directory)
    if not candidates:
        raise FileNotFoundError("No NIfTI files found after conversion.")
    return max(candidates, key=lambda item: item.stat().st_size)


def _is_dicom_file(path: Path) -> bool:
    if path.suffix.lower() == ".dcm":
        return True
    try:
        with path.open("rb") as handle:
            handle.seek(128)
            return handle.read(4) == b"DICM"
    except OSError:
        return False


def _find_dicom_root(directory: Path) -> Path:
    for item in directory.rglob("*"):
        if item.is_file() and _is_dicom_file(item):
            return item.parent
    return directory


def _convert_dicom_to_nifti(dicom_dir: Path, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    dicom2nifti.convert_directory(
        str(dicom_dir), str(output_dir), compression=True, reorient=True
    )
    return _find_largest_nifti(output_dir)


def _load_single_nifti(path: Path) -> Tuple[np.ndarray, List[float]]:
    image = nib.load(str(path))
    data = image.get_fdata().astype(np.float32)
    if data.ndim == 4 and data.shape[-1] == 1:
        data = data[..., 0]
    if data.ndim < 3 or data.ndim > 4:
        raise ValueError(
            f"Expected 3D or 4D NIfTI volume, got shape {data.shape}."
        )
    zooms = [float(item) for item in image.header.get_zooms()[:3]]
    return data, zooms


def _stack_nifti_files(files: List[Path]) -> Tuple[np.ndarray, List[float]]:
    images = [nib.load(str(path)) for path in files]
    base_shape = images[0].shape
    if len(base_shape) != 3:
        raise ValueError(
            f"Each modality must be a 3D volume. Got shape {base_shape}."
        )
    base_affine = images[0].affine
    stacked = []
    for image in images:
        if image.shape != base_shape:
            raise ValueError("All modalities must share the same shape.")
        if not np.allclose(image.affine, base_affine):
            raise ValueError("All modalities must share the same affine.")
        stacked.append(image.get_fdata().astype(np.float32))
    stacked_data = np.stack(stacked, axis=-1)
    zooms = [float(item) for item in images[0].header.get_zooms()[:3]]
    return stacked_data, zooms


def _load_volume_data(path: Path) -> Tuple[np.ndarray, List[float]]:
    if path.is_dir():
        nifti_files = _find_nifti_files(path)
        if nifti_files:
            if len(nifti_files) == 1:
                return _load_single_nifti(nifti_files[0])
            return _stack_nifti_files(nifti_files)

        dicom_root = _find_dicom_root(path)
        nifti_path = _ensure_dicom_converted(dicom_root)
        return _load_single_nifti(nifti_path)

    if _is_zip_name(path.name):
        extracted_dir = _ensure_zip_extracted(path)
        return _load_volume_data(extracted_dir)

    if _is_nifti_name(path.name):
        return _load_single_nifti(path)

    if _is_dicom_file(path):
        dicom_root = _find_dicom_root(path.parent)
        nifti_path = _ensure_dicom_converted(dicom_root)
        return _load_single_nifti(nifti_path)

    raise ValueError("Unsupported upload format for preview.")


def _slice_from_nifti(
    path: Path, axis_index: int, index: int, channel: int
) -> np.ndarray:
    target_path = _ensure_uncompressed_nifti(path)
    image = nib.load(str(target_path))
    shape = image.shape
    if len(shape) < 3 or len(shape) > 4:
        raise ValueError(f"Expected 3D or 4D NIfTI volume, got shape {shape}.")

    data = image.dataobj
    if len(shape) == 4:
        if channel >= shape[3]:
            raise ValueError("Channel index out of range.")
        data = data[..., channel]

    max_index = shape[axis_index] - 1
    if index > max_index:
        raise ValueError(f"Slice index out of range. Max index is {max_index}.")

    if axis_index == 0:
        return np.asarray(data[index, :, :])
    if axis_index == 1:
        return np.asarray(data[:, index, :])
    return np.asarray(data[:, :, index])


def _slice_from_directory(
    path: Path, axis_index: int, index: int, channel: int
) -> np.ndarray:
    nifti_files = _find_nifti_files(path)
    if nifti_files:
        if len(nifti_files) > 1:
            if channel >= len(nifti_files):
                raise ValueError("Channel index out of range.")
            selected = nifti_files[channel]
        else:
            selected = nifti_files[0]
        return _slice_from_nifti(selected, axis_index, index, 0)

    dicom_root = _find_dicom_root(path)
    nifti_path = _ensure_dicom_converted(dicom_root)
    return _slice_from_nifti(nifti_path, axis_index, index, 0)


def _load_slice_data(
    path: Path, axis_index: int, index: int, channel: int
) -> np.ndarray:
    if path.is_dir():
        return _slice_from_directory(path, axis_index, index, channel)
    if _is_zip_name(path.name):
        extracted_dir = _ensure_zip_extracted(path)
        return _slice_from_directory(extracted_dir, axis_index, index, channel)
    if _is_nifti_name(path.name):
        return _slice_from_nifti(path, axis_index, index, channel)
    if _is_dicom_file(path):
        dicom_root = _find_dicom_root(path.parent)
        nifti_path = _ensure_dicom_converted(dicom_root)
        return _slice_from_nifti(nifti_path, axis_index, index, 0)
    raise ValueError("Unsupported upload format for preview.")


def _normalize_slice(slice_data: np.ndarray) -> np.ndarray:
    data = np.asarray(slice_data, dtype=np.float32)
    if data.size == 0:
        return np.zeros((1, 1), dtype=np.uint8)
    finite = data[np.isfinite(data)]
    if finite.size == 0:
        return np.zeros_like(data, dtype=np.uint8)
    lower, upper = np.percentile(finite, (1, 99))
    if upper <= lower:
        lower = float(finite.min())
        upper = float(finite.max())
    if upper <= lower:
        return np.zeros_like(data, dtype=np.uint8)
    scaled = (np.clip(data, lower, upper) - lower) / (upper - lower)
    return (scaled * 255).astype(np.uint8)


_COLORMAP_POINTS: Dict[str, List[Tuple[float, Tuple[float, float, float]]]] = {
    "grayscale": [(0.0, (0.0, 0.0, 0.0)), (1.0, (1.0, 1.0, 1.0))],
    "bone": [
        (0.0, (0.0, 0.0, 0.0)),
        (0.4, (0.55, 0.62, 0.7)),
        (0.8, (0.85, 0.9, 0.95)),
        (1.0, (1.0, 1.0, 1.0)),
    ],
    "hot": [
        (0.0, (0.0, 0.0, 0.0)),
        (0.3, (0.8, 0.0, 0.0)),
        (0.6, (1.0, 0.6, 0.0)),
        (1.0, (1.0, 1.0, 1.0)),
    ],
    "cool": [(0.0, (0.0, 1.0, 1.0)), (1.0, (1.0, 0.0, 1.0))],
    "viridis": [
        (0.0, (0.267, 0.004, 0.329)),
        (0.25, (0.283, 0.141, 0.458)),
        (0.5, (0.254, 0.265, 0.53)),
        (0.75, (0.163, 0.471, 0.558)),
        (1.0, (0.993, 0.906, 0.144)),
    ],
}
_COLORMAP_LUT: Dict[str, np.ndarray] = {}


def _build_colormap_lut(
    points: List[Tuple[float, Tuple[float, float, float]]],
) -> np.ndarray:
    stops = sorted(points, key=lambda item: item[0])
    lut = np.zeros((256, 3), dtype=np.uint8)
    for i in range(256):
        t = i / 255.0
        for index in range(len(stops) - 1):
            left_pos, left_rgb = stops[index]
            right_pos, right_rgb = stops[index + 1]
            if t <= right_pos:
                if right_pos <= left_pos:
                    local = 0.0
                else:
                    local = (t - left_pos) / (right_pos - left_pos)
                r = left_rgb[0] + (right_rgb[0] - left_rgb[0]) * local
                g = left_rgb[1] + (right_rgb[1] - left_rgb[1]) * local
                b = left_rgb[2] + (right_rgb[2] - left_rgb[2]) * local
                lut[i] = [int(round(r * 255)), int(round(g * 255)), int(round(b * 255))]
                break
        else:
            lut[i] = [int(round(stops[-1][1][0] * 255)),
                      int(round(stops[-1][1][1] * 255)),
                      int(round(stops[-1][1][2] * 255))]
    return lut


def _get_colormap_lut(name: str) -> np.ndarray:
    key = name.strip().lower()
    if key not in _COLORMAP_POINTS:
        raise ValueError("Unsupported colormap.")
    if key not in _COLORMAP_LUT:
        _COLORMAP_LUT[key] = _build_colormap_lut(_COLORMAP_POINTS[key])
    return _COLORMAP_LUT[key]


def _apply_colormap(normalized: np.ndarray, name: str) -> Image.Image:
    key = name.strip().lower()
    if key == "grayscale":
        return Image.fromarray(normalized, mode="L")
    lut = _get_colormap_lut(key)
    rgb = lut[normalized]
    return Image.fromarray(rgb, mode="RGB")


def _parse_axis(axis: str) -> int:
    value = axis.strip().lower()
    if value in {"0", "sagittal"}:
        return 0
    if value in {"1", "coronal"}:
        return 1
    if value in {"2", "axial"}:
        return 2
    raise ValueError("Axis must be sagittal, coronal, or axial.")


def _clamp_index(value: int, size: int) -> int:
    if size <= 0:
        return 0
    return max(0, min(value, size - 1))


def _temp_nifti_from_channel(
    image: nib.Nifti1Image, channel: int, temp_dir: Path
) -> Path:
    data = image.get_fdata().astype(np.float32)
    if data.ndim != 4:
        raise ValueError("Expected a 4D NIfTI volume for channel extraction.")
    channel_index = _clamp_index(channel, data.shape[3])
    sliced = data[..., channel_index]
    temp_dir.mkdir(parents=True, exist_ok=True)
    out_path = temp_dir / f"channel_{channel_index}.nii.gz"
    nib.save(nib.Nifti1Image(sliced, image.affine, image.header), str(out_path))
    return out_path


def _preview_nifti(path: Path) -> Dict[str, object]:
    image = nib.load(str(path))
    return {
        "name": path.name,
        "shape": [int(item) for item in image.shape],
        "zooms": [float(item) for item in image.header.get_zooms()],
        "dtype": str(image.get_data_dtype()),
    }


def _preview_dicom_series(files: List[Path]) -> Dict[str, object]:
    first = files[0]
    dataset = pydicom.dcmread(str(first), stop_before_pixels=True, force=True)
    rows = int(getattr(dataset, "Rows", 0) or 0)
    cols = int(getattr(dataset, "Columns", 0) or 0)
    spacing = getattr(dataset, "PixelSpacing", None)
    thickness = getattr(dataset, "SliceThickness", None)
    modality = str(getattr(dataset, "Modality", ""))
    return {
        "slices": len(files),
        "rows": rows,
        "cols": cols,
        "pixel_spacing": [float(item) for item in spacing] if spacing is not None else None,
        "slice_thickness": float(thickness) if thickness is not None else None,
        "modality": modality,
    }


def _alignment_warnings(items: List[Dict[str, object]]) -> List[str]:
    warnings: List[str] = []
    if len(items) < 2:
        return warnings
    shapes = {tuple(item.get("shape", [])) for item in items}
    zooms = {tuple(item.get("zooms", [])) for item in items}
    if len(shapes) > 1:
        warnings.append("NIfTI shapes differ between files.")
    if len(zooms) > 1:
        warnings.append("NIfTI voxel spacing (zooms) differs between files.")
    return warnings


def _preview_directory(path: Path) -> Dict[str, object]:
    nifti_files = sorted(
        list(path.rglob("*.nii")) + list(path.rglob("*.nii.gz"))
    )
    if nifti_files:
        items = [_preview_nifti(item) for item in nifti_files]
        return {
            "kind": "nifti_dir",
            "files": items,
            "warnings": _alignment_warnings(items),
        }

    dicom_files = []
    for item in path.rglob("*"):
        if not item.is_file():
            continue
        if item.suffix.lower() == ".dcm":
            dicom_files.append(item)
            continue
        try:
            with item.open("rb") as handle:
                if _looks_like_dicom(handle.read(132)):
                    dicom_files.append(item)
        except OSError:
            continue
    if dicom_files:
        return {
            "kind": "dicom_dir",
            "dicom": _preview_dicom_series(dicom_files),
            "warnings": [],
        }

    return {"kind": "unknown", "warnings": ["No NIfTI or DICOM files detected."]}


def _preview_zip(path: Path) -> Dict[str, object]:
    with zipfile.ZipFile(path, "r") as archive:
        names = archive.namelist()
        nifti_names = [name for name in names if _is_nifti_name(name)]
        dicom_names = [name for name in names if name.lower().endswith(".dcm")]

        if nifti_names:
            with tempfile.TemporaryDirectory(prefix="zip_preview_") as temp_dir:
                archive.extractall(temp_dir)
                return _preview_directory(Path(temp_dir))

        if dicom_names:
            return {
                "kind": "dicom_zip",
                "dicom": {"slices": len(dicom_names)},
                "warnings": [],
            }

    return {"kind": "zip", "warnings": ["Unsupported zip contents."]}


@router.post("/uploads")
async def upload_scan(file: UploadFile = File(...)):
    data = await file.read()
    path = save_upload(settings.upload_dir, file.filename, data)
    kind = _infer_file_kind(file.filename, data)
    return {"filename": file.filename, "saved_path": path, "kind": kind}


@router.post("/uploads/batch")
async def upload_scan_batch(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    payload: List[Tuple[str, bytes]] = []
    kinds = set()
    for item in files:
        data = await item.read()
        kind = _infer_file_kind(item.filename, data)
        payload.append((item.filename, data))
        kinds.add(kind)

    if "zip" in kinds:
        raise HTTPException(
            status_code=400,
            detail="Zip uploads must be sent as a single file, not batch.",
        )
    if len(kinds - {"nifti", "dicom"}) > 0:
        raise HTTPException(
            status_code=400,
            detail="Batch upload supports only NIfTI or DICOM files.",
        )
    if len(kinds) > 1:
        raise HTTPException(
            status_code=400,
            detail="Do not mix NIfTI and DICOM files in the same batch.",
        )

    saved_path = save_uploads_batch(settings.upload_dir, payload)
    return {
        "filenames": [item.filename for item in files],
        "saved_path": saved_path,
        "kind": "nifti_multi" if "nifti" in kinds else "dicom_series",
    }


@router.get("/uploads/preview")
def preview_upload(path: str = Query(..., description="Uploaded path to inspect.")):
    resolved = _resolve_upload_path(path)

    if resolved.is_dir():
        return _preview_directory(resolved)
    if _is_zip_name(resolved.name):
        return _preview_zip(resolved)
    if _is_nifti_name(resolved.name):
        return {"kind": "nifti", "files": [_preview_nifti(resolved)], "warnings": []}

    try:
        data = resolved.read_bytes()
    except OSError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if _infer_file_kind(resolved.name, data) == "dicom":
        return {
            "kind": "dicom_file",
            "dicom": _preview_dicom_series([resolved]),
            "warnings": [],
        }

    return {"kind": "unknown", "warnings": ["Unsupported upload format."]}


@router.get("/uploads/volume-info")
def volume_info(path: str = Query(..., description="Uploaded path to inspect.")):
    resolved = _resolve_upload_path(path)
    try:
        volume, zooms = _load_volume_data(resolved)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if volume.ndim < 3:
        raise HTTPException(status_code=400, detail="Volume has fewer than 3 dimensions.")

    channels = volume.shape[3] if volume.ndim == 4 else 1
    shape = [int(item) for item in volume.shape[:3]]
    return {"shape": shape, "channels": int(channels), "zooms": zooms}


@router.get("/uploads/volume-file")
def volume_file(
    path: str = Query(..., description="Uploaded path to render."),
    channel: int = Query(0, ge=0),
):
    resolved = _resolve_upload_path(path)

    if resolved.is_file() and _is_nifti_name(resolved.name):
        if resolved.name.lower().endswith(".nii.gz"):
            try:
                resolved = _ensure_uncompressed_nifti(resolved)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))
        image = nib.load(str(resolved))
        if len(image.shape) == 4 and image.shape[3] > 1:
            temp_dir = Path(settings.temp_dir) / f"viewer_{uuid4().hex}"
            out_path = _temp_nifti_from_channel(image, channel, temp_dir)
            task = BackgroundTask(shutil.rmtree, temp_dir, True)
            return FileResponse(str(out_path), filename=out_path.name, background=task)
        return FileResponse(str(resolved), filename=resolved.name)

    if resolved.is_dir():
        nifti_files = _find_nifti_files(resolved)
        if nifti_files:
            index = _clamp_index(channel, len(nifti_files))
            return FileResponse(str(nifti_files[index]), filename=nifti_files[index].name)

        dicom_root = _find_dicom_root(resolved)
        nifti_path = _ensure_dicom_converted(dicom_root)
        return FileResponse(str(nifti_path), filename=nifti_path.name)

    if _is_zip_name(resolved.name):
        try:
            temp_dir = _ensure_zip_extracted(resolved)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        nifti_files = _find_nifti_files(temp_dir)
        if nifti_files:
            index = _clamp_index(channel, len(nifti_files))
            return FileResponse(str(nifti_files[index]), filename=nifti_files[index].name)

        dicom_root = _find_dicom_root(temp_dir)
        nifti_path = _ensure_dicom_converted(dicom_root)
        return FileResponse(str(nifti_path), filename=nifti_path.name)

    if _is_dicom_file(resolved):
        dicom_root = _find_dicom_root(resolved.parent)
        nifti_path = _ensure_dicom_converted(dicom_root)
        return FileResponse(str(nifti_path), filename=nifti_path.name)

    raise HTTPException(status_code=400, detail="Unsupported upload format.")


@router.get("/uploads/slice")
def volume_slice(
    path: str = Query(..., description="Uploaded path to inspect."),
    axis: str = Query("axial", description="sagittal, coronal, or axial"),
    index: int = Query(0, ge=0),
    channel: int = Query(0, ge=0),
    colormap: str = Query("grayscale", description="Slice colormap name."),
):
    resolved = _resolve_upload_path(path)
    try:
        axis_index = _parse_axis(axis)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        slice_data = _load_slice_data(resolved, axis_index, index, channel)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    normalized = _normalize_slice(slice_data)
    try:
        image = _apply_colormap(normalized, colormap)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return Response(
        content=buffer.getvalue(),
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=120"},
    )
