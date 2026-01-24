import json
import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import uuid4

import dicom2nifti
import nibabel as nib
import numpy as np
import torch
from monai.bundle import scripts as bundle_scripts
from monai.inferers import SlidingWindowInferer

from app.services.models_registry import ModelSpec
from app.services.storage import ensure_dir


def _is_nifti(path: Path) -> bool:
    suffixes = [suffix.lower() for suffix in path.suffixes]
    return suffixes[-1:] == [".nii"] or suffixes[-2:] == [".nii", ".gz"]


def _find_largest_nifti(directory: Path) -> Path:
    candidates = list(directory.glob("*.nii")) + list(directory.glob("*.nii.gz"))
    if not candidates:
        raise FileNotFoundError("No NIfTI files found after conversion.")
    return max(candidates, key=lambda item: item.stat().st_size)


def _find_nifti_files(directory: Path) -> List[Path]:
    candidates = list(directory.rglob("*.nii")) + list(directory.rglob("*.nii.gz"))
    return sorted(candidates, key=lambda item: item.name.lower())


def _convert_dicom_to_nifti(dicom_dir: Path, output_dir: Path) -> Path:
    ensure_dir(str(output_dir))
    dicom2nifti.convert_directory(
        str(dicom_dir), str(output_dir), compression=True, reorient=True
    )
    return _find_largest_nifti(output_dir)


def _is_dicom_file(path: Path) -> bool:
    try:
        with path.open("rb") as handle:
            handle.seek(128)
            return handle.read(4) == b"DICM"
    except OSError:
        return False


def _find_dicom_root(directory: Path) -> Path:
    for item in directory.rglob("*"):
        if item.is_file() and (item.suffix.lower() == ".dcm" or _is_dicom_file(item)):
            return item.parent
    return directory


def _extract_zip(zip_path: Path, output_dir: Path) -> Path:
    ensure_dir(str(output_dir))
    with zipfile.ZipFile(zip_path, "r") as archive:
        archive.extractall(output_dir)
    return output_dir


InputType = Union[str, List[str]]


def _select_nifti_input(directory: Path) -> Optional[InputType]:
    candidates = _find_nifti_files(directory)
    if not candidates:
        return None
    if len(candidates) == 1:
        return str(candidates[0])
    return [str(path) for path in candidates]


def prepare_input(saved_path: str, temp_dir: str) -> Tuple[InputType, List[Path]]:
    path = Path(saved_path)
    if not path.exists():
        raise FileNotFoundError(f"Input path not found: {saved_path}")

    ensure_dir(temp_dir)
    cleanup: List[Path] = []
    if path.is_dir():
        nifti_input = _select_nifti_input(path)
        if nifti_input:
            return nifti_input, cleanup
        nifti_dir = Path(temp_dir) / f"dicom_{uuid4().hex}"
        cleanup.append(nifti_dir)
        dicom_root = _find_dicom_root(path)
        nifti_path = _convert_dicom_to_nifti(dicom_root, nifti_dir)
        return str(nifti_path), cleanup

    if path.suffix.lower() == ".zip":
        unzip_dir = Path(temp_dir) / f"dicom_zip_{uuid4().hex}"
        cleanup.append(unzip_dir)
        _extract_zip(path, unzip_dir)
        nifti_input = _select_nifti_input(unzip_dir)
        if nifti_input:
            return nifti_input, cleanup
        dicom_root = _find_dicom_root(unzip_dir)
        nifti_dir = Path(temp_dir) / f"dicom_nifti_{uuid4().hex}"
        cleanup.append(nifti_dir)
        nifti_path = _convert_dicom_to_nifti(dicom_root, nifti_dir)
        return str(nifti_path), cleanup

    if _is_nifti(path):
        return str(path), cleanup

    if path.suffix.lower() == ".dcm":
        nifti_dir = Path(temp_dir) / f"dicom_file_{uuid4().hex}"
        cleanup.append(nifti_dir)
        dicom_root = _find_dicom_root(path.parent)
        nifti_path = _convert_dicom_to_nifti(dicom_root, nifti_dir)
        return str(nifti_path), cleanup

    raise ValueError("Unsupported input format. Use NIfTI or zipped DICOM.")


def _normalize_intensity(volume: np.ndarray, modality: str) -> np.ndarray:
    if modality.upper() == "CT":
        clipped = np.clip(volume, -1000, 1000)
        return (clipped + 1000) / 2000
    mean = float(volume.mean())
    std = float(volume.std()) or 1.0
    return (volume - mean) / std


def _load_volume(path: str, modality: str) -> Tuple[np.ndarray, nib.Nifti1Image]:
    image = nib.load(path)
    data = image.get_fdata().astype(np.float32)
    if data.ndim > 3:
        data = data[..., 0]
    data = _normalize_intensity(data, modality)
    return data, image


def run_torchscript(
    model: ModelSpec,
    input_path: str,
    output_dir: str,
    job_id: str,
    device: str,
) -> Tuple[str, str, float]:
    volume, image = _load_volume(input_path, model.modality)
    tensor = torch.from_numpy(volume)[None, None, ...].to(device)

    weights_path = Path(model.weights_path)
    if not weights_path.is_file():
        raise FileNotFoundError(f"Model weights not found: {weights_path}")

    network = torch.jit.load(str(weights_path), map_location=device)
    network.eval()

    with torch.no_grad():
        if model.roi_size:
            inferer = SlidingWindowInferer(
                roi_size=model.roi_size, sw_batch_size=1, overlap=0.25
            )
            prediction = inferer(tensor, network)
        else:
            prediction = network(tensor)

    pred_np = prediction.detach().cpu().numpy()
    if pred_np.shape[1] > 1:
        mask = np.argmax(pred_np, axis=1)[0].astype(np.uint8)
    else:
        mask = (pred_np[0, 0] > model.threshold).astype(np.uint8)

    output_path = Path(output_dir)
    ensure_dir(str(output_path))
    mask_path = output_path / "mask.nii.gz"
    report_path = output_path / "report.json"

    nib.save(nib.Nifti1Image(mask, image.affine, image.header), str(mask_path))

    voxel_volume_mm3 = float(np.prod(image.header.get_zooms()[:3]))
    tumor_volume_cm3 = float(mask.sum() * voxel_volume_mm3 / 1000.0)

    report = {
        "job_id": job_id,
        "model_id": model.id,
        "modality": model.modality,
        "input_path": input_path,
        "mask_path": str(mask_path),
        "tumor_volume_cm3": tumor_volume_cm3,
        "voxel_volume_mm3": voxel_volume_mm3,
        "dimensions": list(mask.shape),
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    return str(mask_path), str(report_path), tumor_volume_cm3


def _find_output_mask(output_dir: Path) -> Path:
    candidates = list(output_dir.rglob("*.nii")) + list(output_dir.rglob("*.nii.gz"))
    if not candidates:
        raise FileNotFoundError("No output mask produced by bundle inference.")
    return max(candidates, key=lambda item: item.stat().st_mtime)


def _infer_expected_channels(config_data: Dict[str, Any]) -> Optional[int]:
    network_def = config_data.get("network_def")
    if isinstance(network_def, dict):
        in_channels = network_def.get("in_channels")
        if isinstance(in_channels, int) and in_channels > 0:
            return in_channels
    return None


def _validate_single_nifti(input_path: str, expected_channels: Optional[int]) -> None:
    image = nib.load(input_path)
    shape = image.shape
    ndim = len(shape)
    if ndim < 3:
        raise ValueError(
            f"Input volume is {ndim}D (shape {shape}). "
            "This model expects a 3D NIfTI volume."
        )
    if ndim > 4:
        raise ValueError(
            f"Input volume has {ndim} dimensions (shape {shape}). "
            "Expected a 3D or 4D NIfTI volume."
        )
    if expected_channels and expected_channels > 1:
        if ndim == 3:
            raise ValueError(
                f"Model expects {expected_channels} channels but got a single-channel "
                "3D volume. Provide a multi-channel NIfTI or a zip of aligned NIfTI files."
            )
        if ndim == 4 and shape[-1] != expected_channels:
            raise ValueError(
                f"Model expects {expected_channels} channels but input has {shape[-1]}."
            )
    if expected_channels == 1 and ndim == 4 and shape[-1] != 1:
        raise ValueError(
            f"Model expects 1 channel but input has {shape[-1]} channels."
        )


def _stack_nifti_modalities(input_paths: List[str], output_dir: Path) -> str:
    images = [nib.load(path) for path in input_paths]
    base_shape = images[0].shape
    if len(base_shape) != 3:
        raise ValueError(
            f"Each modality must be a 3D volume. Got shape {base_shape}."
        )
    base_affine = images[0].affine
    stacked = []
    for idx, image in enumerate(images):
        shape = image.shape
        if len(shape) != 3:
            raise ValueError(
                f"Each modality must be a 3D volume. Got shape {shape}."
            )
        if shape != base_shape:
            raise ValueError(
                "All modalities must share the same shape and voxel grid."
            )
        if not np.allclose(image.affine, base_affine):
            raise ValueError(
                "All modalities must share the same affine transform."
            )
        stacked.append(image.get_fdata().astype(np.float32))
    stacked_data = np.stack(stacked, axis=-1)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "multi_channel_input.nii.gz"
    nib.save(nib.Nifti1Image(stacked_data, base_affine, images[0].header), str(output_path))
    return str(output_path)


def _select_list_key(config_data: Dict[str, Any]) -> Optional[str]:
    for key in ("datalist", "test_datalist", "val_datalist", "infer_datalist"):
        if key in config_data:
            return key
    return None


def _build_datalist(
    config_data: Dict[str, Any],
    list_key: str,
    image_key: str,
    input_item: InputType,
) -> List[Any]:
    dataset = config_data.get("dataset", {})
    data_expr = dataset.get("data", "")
    list_format = "dict"
    if isinstance(data_expr, str) and "for i in @" in data_expr:
        list_format = "list"
    if list_format == "list":
        if isinstance(input_item, list):
            return input_item
        return [input_item]
    image_value: Any = input_item if isinstance(input_item, list) else input_item
    return [{image_key: image_value}]


def _channel_first_overrides(
    config_data: Dict[str, Any], expected_channels: Optional[int]
) -> Dict[str, Any]:
    if not expected_channels or expected_channels <= 1:
        return {}
    preprocessing = config_data.get("preprocessing")
    if not isinstance(preprocessing, dict):
        return {}
    transforms = preprocessing.get("transforms")
    if not isinstance(transforms, list):
        return {}
    for transform in transforms:
        if (
            isinstance(transform, dict)
            and "EnsureChannelFirst" in str(transform.get("_target_", ""))
        ):
            return {}
    for idx, transform in enumerate(transforms):
        if (
            isinstance(transform, dict)
            and "LoadImaged" in str(transform.get("_target_", ""))
        ):
            return {
                f"preprocessing#transforms#{idx}#ensure_channel_first": True,
                f"preprocessing#transforms#{idx}#channel_dim": -1,
            }
    return {}


def _parse_int_list(value: str) -> Optional[List[int]]:
    parts = [item.strip() for item in value.split(",") if item.strip()]
    if not parts:
        return None
    numbers: List[int] = []
    for item in parts:
        if not item.isdigit():
            return None
        numbers.append(int(item))
    return numbers


def _inferer_memory_overrides(config_data: Dict[str, Any], device: str) -> Dict[str, Any]:
    overrides: Dict[str, Any] = {}
    roi_env = os.getenv("MONAI_ROI_SIZE")
    if roi_env:
        roi_size = _parse_int_list(roi_env)
        if roi_size:
            overrides["inferer#roi_size"] = roi_size
            overrides["inferer#sw_batch_size"] = 1
            return overrides

    if device != "cuda" or not torch.cuda.is_available():
        return overrides

    inferer = config_data.get("inferer")
    if not isinstance(inferer, dict):
        return overrides
    roi_size = inferer.get("roi_size")
    if not (isinstance(roi_size, list) and len(roi_size) == 3):
        return overrides

    try:
        total_mem_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
    except Exception:  # noqa: BLE001
        return overrides

    target = None
    if total_mem_gb <= 8:
        target = 128
    elif total_mem_gb <= 12:
        target = 160

    if target:
        overrides["inferer#roi_size"] = [min(int(dim), target) for dim in roi_size]
        overrides["inferer#sw_batch_size"] = 1
    return overrides


def run_monai_bundle(
    model: ModelSpec,
    input_item: InputType,
    output_dir: str,
    job_id: str,
    device: str,
) -> Tuple[str, str, float]:
    weights_path = Path(model.weights_path)
    if not weights_path.is_file():
        raise FileNotFoundError(f"Model weights not found: {weights_path}")

    bundle_dir = (
        Path(model.bundle_dir)
        if model.bundle_dir
        else weights_path.parents[1]
    )
    config_path = (
        Path(model.config_path)
        if model.config_path
        else bundle_dir / "configs" / "inference.json"
    )
    meta_path = bundle_dir / "configs" / "metadata.json"
    if not config_path.is_file():
        raise FileNotFoundError(f"Inference config not found: {config_path}")
    if not meta_path.is_file():
        raise FileNotFoundError(f"Metadata config not found: {meta_path}")

    config_data = json.loads(config_path.read_text(encoding="utf-8"))
    expected_channels = _infer_expected_channels(config_data)
    temp_dir_handle: Optional[tempfile.TemporaryDirectory] = None

    if isinstance(input_item, list):
        if not expected_channels or expected_channels <= 1:
            raise ValueError(
                "Multiple NIfTI files detected, but this model expects a single volume."
            )
        if len(input_item) != expected_channels:
            raise ValueError(
                f"Model expects {expected_channels} modalities but received {len(input_item)} files."
            )
        temp_dir_handle = tempfile.TemporaryDirectory(prefix="monai_input_")
        input_item = _stack_nifti_modalities(
            input_item, Path(temp_dir_handle.name)
        )
    else:
        _validate_single_nifti(input_item, expected_channels)
    image_key = config_data.get("image_key", "image")
    list_key = _select_list_key(config_data)
    if not list_key:
        raise ValueError("Unable to locate a datalist key in bundle config.")

    overrides: Dict[str, Any] = {
        "bundle_root": str(bundle_dir),
        "output_dir": str(output_dir),
        list_key: _build_datalist(config_data, list_key, image_key, input_item),
        "device": torch.device(device),
    }
    overrides.update(_channel_first_overrides(config_data, expected_channels))
    overrides.update(_inferer_memory_overrides(config_data, device))

    if "dataset_dir" in config_data:
        input_path = input_item[0] if isinstance(input_item, list) else input_item
        overrides["dataset_dir"] = str(Path(input_path).parent)

    if "dataloader" in config_data:
        overrides["dataloader#num_workers"] = 0

    if device == "cpu":
        if "amp" in config_data:
            overrides["amp"] = False
        if "evaluator" in config_data:
            overrides["evaluator#amp"] = False
        if "checkpointloader" in config_data:
            overrides["checkpointloader#map_location"] = torch.device("cpu")

    try:
        bundle_scripts.run(
            meta_file=str(meta_path),
            config_file=str(config_path),
            **overrides,
        )
    finally:
        if temp_dir_handle is not None:
            temp_dir_handle.cleanup()

    output_path = Path(output_dir)
    mask_path = _find_output_mask(output_path)
    report_path = output_path / "report.json"

    mask_image = nib.load(str(mask_path))
    mask_data = mask_image.get_fdata()
    mask = mask_data > 0
    voxel_volume_mm3 = float(np.prod(mask_image.header.get_zooms()[:3]))
    tumor_volume_cm3 = float(mask.sum() * voxel_volume_mm3 / 1000.0)

    report = {
        "job_id": job_id,
        "model_id": model.id,
        "modality": model.modality,
        "input_path": input_item,
        "mask_path": str(mask_path),
        "tumor_volume_cm3": tumor_volume_cm3,
        "voxel_volume_mm3": voxel_volume_mm3,
        "dimensions": list(mask.shape),
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    return str(mask_path), str(report_path), tumor_volume_cm3


def cleanup_paths(paths: List[Path]) -> None:
    for path in paths:
        if path.exists():
            shutil.rmtree(path, ignore_errors=True)
