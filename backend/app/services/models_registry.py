import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class ModelSpec:
    id: str
    name: str
    task: str
    modality: str
    input: List[str]
    runner: str
    weights_path: str
    description: str
    speed: str
    roi_size: Optional[List[int]] = None
    threshold: float = 0.5
    bundle_dir: Optional[str] = None
    config_path: Optional[str] = None


DEFAULT_BUNDLES = [
    {
        "id": "brats_mri_segmentation",
        "name": "BraTS MRI Segmentation",
        "task": "brain_tumor_segmentation",
        "modality": "MRI",
        "input": ["nifti_multi"],
        "description": "BraTS brain tumor segmentation (multi-modal MRI).",
    },
    {
        "id": "spleen_ct_segmentation",
        "name": "Spleen CT Segmentation",
        "task": "organ_segmentation",
        "modality": "CT",
        "input": ["nifti", "dicom_zip"],
        "description": "Spleen segmentation on CT (Medical Decathlon).",
    },
]


def _default_models(models_dir: str) -> List[ModelSpec]:
    base = Path(models_dir) / "bundles"
    models: List[ModelSpec] = []
    for bundle in DEFAULT_BUNDLES:
        bundle_dir = base / bundle["id"]
        models.append(
            ModelSpec(
                id=bundle["id"],
                name=bundle["name"],
                task=bundle["task"],
                modality=bundle["modality"],
                input=bundle["input"],
                runner="monai_bundle",
                weights_path=str(bundle_dir / "models" / "model.pt"),
                description=bundle["description"],
                speed="unknown",
                bundle_dir=str(bundle_dir),
                config_path=str(bundle_dir / "configs" / "inference.json"),
            )
        )
    return models


def _resolve_weights_path(models_dir: str, raw_path: str) -> str:
    path = Path(raw_path)
    if path.is_absolute():
        return str(path)
    return str(Path(models_dir) / path)


def _resolve_optional_path(models_dir: str, raw_path: Optional[str]) -> Optional[str]:
    if not raw_path:
        return None
    return _resolve_weights_path(models_dir, raw_path)


def _load_registry_file(models_dir: str) -> List[ModelSpec]:
    registry_path = Path(models_dir) / "registry.json"
    if not registry_path.exists():
        return []
    try:
        data = json.loads(registry_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    models: List[ModelSpec] = []
    for entry in data.get("models", []):
        bundle_dir = _resolve_optional_path(models_dir, entry.get("bundle_dir"))
        config_path = _resolve_optional_path(models_dir, entry.get("config_path"))
        weights_path = entry.get("weights_path")
        if entry.get("runner") == "monai_bundle" and not weights_path and bundle_dir:
            weights_path = str(Path(bundle_dir) / "models" / "model.pt")
        models.append(
            ModelSpec(
                id=entry["id"],
                name=entry["name"],
                task=entry.get("task", "segmentation"),
                modality=entry.get("modality", "Unknown"),
                input=entry.get("input", ["nifti"]),
                runner=entry.get("runner", "torchscript"),
                weights_path=_resolve_weights_path(models_dir, weights_path or ""),
                description=entry.get("description", ""),
                speed=entry.get("speed", "unknown"),
                roi_size=entry.get("roi_size"),
                threshold=float(entry.get("threshold", 0.5)),
                bundle_dir=bundle_dir,
                config_path=config_path,
            )
        )
    return models


def _infer_modality(metadata: Dict[str, Any]) -> str:
    inputs = metadata.get("network_data_format", {}).get("inputs", {})
    for value in inputs.values():
        modality = value.get("modality")
        if modality:
            return modality
    return metadata.get("modality", "Unknown")


def _infer_inputs(metadata: Dict[str, Any]) -> List[str]:
    inputs = metadata.get("network_data_format", {}).get("inputs", {})
    if inputs:
        first = next(iter(inputs.values()))
        num_channels = first.get("num_channels", 1)
        if isinstance(num_channels, int) and num_channels > 1:
            return ["nifti_multi", "dicom_zip"]
    return ["nifti", "dicom_zip"]


def _load_bundle_models(models_dir: str) -> List[ModelSpec]:
    bundles_dir = Path(models_dir) / "bundles"
    if not bundles_dir.is_dir():
        return []
    models: List[ModelSpec] = []
    for bundle_dir in sorted(bundles_dir.iterdir()):
        if not bundle_dir.is_dir():
            continue
        metadata_path = bundle_dir / "configs" / "metadata.json"
        config_path = bundle_dir / "configs" / "inference.json"
        weights_path = bundle_dir / "models" / "model.pt"
        if not metadata_path.is_file() or not config_path.is_file():
            continue
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        models.append(
            ModelSpec(
                id=bundle_dir.name,
                name=metadata.get("name", bundle_dir.name),
                task=metadata.get("task", "segmentation"),
                modality=_infer_modality(metadata),
                input=_infer_inputs(metadata),
                runner="monai_bundle",
                weights_path=str(weights_path),
                description=metadata.get("description", ""),
                speed="unknown",
                bundle_dir=str(bundle_dir),
                config_path=str(config_path),
            )
        )
    return models


def _merge_models(*model_groups: List[ModelSpec]) -> List[ModelSpec]:
    merged: Dict[str, ModelSpec] = {}
    for group in model_groups:
        for model in group:
            merged[model.id] = model
    return list(merged.values())


def list_models(models_dir: str) -> List[Dict[str, Any]]:
    registry_models = _load_registry_file(models_dir)
    bundle_models = _load_bundle_models(models_dir)
    models = _merge_models(_default_models(models_dir), bundle_models, registry_models)
    response: List[Dict[str, Any]] = []
    for model in models:
        available = Path(model.weights_path).is_file()
        response.append(
            {
                "id": model.id,
                "name": model.name,
                "type": "segmentation",
                "speed": model.speed,
                "task": model.task,
                "modality": model.modality,
                "input": model.input,
                "description": model.description,
                "available": available,
            }
        )
    return response


def get_model(models_dir: str, model_id: str) -> Optional[ModelSpec]:
    registry_models = _load_registry_file(models_dir)
    bundle_models = _load_bundle_models(models_dir)
    models = _merge_models(_default_models(models_dir), bundle_models, registry_models)
    for model in models:
        if model.id == model_id:
            return model
    return None
