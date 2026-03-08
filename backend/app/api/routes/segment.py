import json
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple
from uuid import uuid4

import torch
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from config import settings
from app.services.inference import (
    cleanup_paths,
    prepare_input,
    run_monai_bundle,
    run_torchscript,
)
from app.services.models_registry import ModelSpec, get_model
from app.services.unet_brats import run_keras_unet_brats

router = APIRouter()

JobStatus = Literal["queued", "running", "done", "error"]


class ApiModel(BaseModel):
    model_config = ConfigDict(protected_namespaces=())


class SegmentRequest(ApiModel):
    saved_path: str
    model_id: str


class SegmentResponse(ApiModel):
    job_id: str


class Metrics(ApiModel):
    tumor_volume_cm3: float


class Outputs(ApiModel):
    mask_path: str
    report_path: str


class SanityReason(ApiModel):
    code: str
    message: str


class SanityInfo(ApiModel):
    flagged: bool
    fallback_used: bool
    primary_runner: str
    fallback_runner: Optional[str] = None
    primary_volume_cm3: Optional[float] = None
    fallback_volume_cm3: Optional[float] = None
    reasons: List[SanityReason] = Field(default_factory=list)


class ResultsResponse(ApiModel):
    job_id: str
    status: JobStatus
    model_id: str
    saved_path: str
    metrics: Metrics
    outputs: Outputs
    sanity: Optional[SanityInfo] = None
    error_message: Optional[str] = None


_jobs: Dict[str, ResultsResponse] = {}
_jobs_lock = threading.Lock()


class JobHistoryItem(ApiModel):
    job_id: str
    status: JobStatus
    model_id: str
    input_path: str
    metrics: Metrics
    outputs: Outputs
    sanity: Optional[SanityInfo] = None
    error_message: Optional[str] = None


def _job_to_history(job: ResultsResponse) -> JobHistoryItem:
    return JobHistoryItem(
        job_id=job.job_id,
        status=job.status,
        model_id=job.model_id,
        input_path=job.saved_path,
        metrics=job.metrics,
        outputs=job.outputs,
        sanity=job.sanity,
        error_message=job.error_message,
    )


def _set_job_status(job_id: str, status: JobStatus, error_message: Optional[str] = None) -> None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job.status = status
        job.error_message = error_message


def _set_job_results(
    job_id: str,
    mask_path: str,
    report_path: str,
    tumor_volume_cm3: float,
    sanity: Optional[SanityInfo] = None,
) -> None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job.status = "done"
        job.metrics = Metrics(tumor_volume_cm3=tumor_volume_cm3)
        job.outputs = Outputs(mask_path=mask_path, report_path=report_path)
        job.sanity = sanity
        job.error_message = None


def _run_inference(
    model: ModelSpec,
    input_item: Any,
    output_dir: str,
    job_id: str,
    device: str,
) -> Tuple[str, str, float]:
    if model.runner == "monai_bundle":
        return run_monai_bundle(
            model=model,
            input_item=input_item,
            output_dir=output_dir,
            job_id=job_id,
            device=device,
        )
    if model.runner == "torchscript":
        if isinstance(input_item, list):
            raise ValueError("TorchScript runner expects a single NIfTI file.")
        return run_torchscript(
            model=model,
            input_path=input_item,
            output_dir=output_dir,
            job_id=job_id,
            device=device,
        )
    if model.runner == "keras_unet_brats":
        return run_keras_unet_brats(
            model=model,
            input_item=input_item,
            output_dir=output_dir,
            job_id=job_id,
        )
    raise ValueError("Unsupported model runner for this server.")


def _as_float(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _read_report(report_path: str) -> Dict[str, Any]:
    path = Path(report_path)
    if not path.is_file():
        return {}
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
        return loaded if isinstance(loaded, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _is_truthy(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _low_volume_threshold_cm3() -> float:
    raw = os.getenv("SEG_SANITY_LOW_VOLUME_CM3")
    parsed = _as_float(raw)
    return parsed if parsed is not None and parsed > 0 else 5.0


def _low_confidence_threshold() -> float:
    raw = os.getenv("SEG_SANITY_LOW_MAX_PROB")
    parsed = _as_float(raw)
    return parsed if parsed is not None and 0.0 < parsed < 1.0 else 0.35


def _evaluate_keras_unet_sanity(
    report_data: Dict[str, Any],
    tumor_volume_cm3: float,
) -> SanityInfo:
    reasons: List[SanityReason] = []

    positive_voxels_raw = _as_float(report_data.get("positive_voxels"))
    positive_voxels = int(positive_voxels_raw) if positive_voxels_raw is not None else None
    max_prob = _as_float(report_data.get("prediction_max_prob"))
    low_volume_threshold = _low_volume_threshold_cm3()
    low_conf_threshold = _low_confidence_threshold()

    if positive_voxels is not None and positive_voxels <= 0:
        reasons.append(
            SanityReason(
                code="zero_voxels",
                message="Primary model predicted zero positive tumor voxels.",
            )
        )
    if tumor_volume_cm3 <= 0.05:
        reasons.append(
            SanityReason(
                code="near_zero_volume",
                message=f"Primary tumor volume is near zero ({tumor_volume_cm3:.3f} cm3).",
            )
        )
    if tumor_volume_cm3 > 0.05 and tumor_volume_cm3 < low_volume_threshold:
        reasons.append(
            SanityReason(
                code="low_volume",
                message=(
                    f"Primary tumor volume ({tumor_volume_cm3:.2f} cm3) is below "
                    f"sanity threshold ({low_volume_threshold:.2f} cm3)."
                ),
            )
        )
    if max_prob is not None and max_prob < low_conf_threshold:
        reasons.append(
            SanityReason(
                code="low_max_confidence",
                message=(
                    f"Primary max prediction confidence ({max_prob:.3f}) is below "
                    f"sanity threshold ({low_conf_threshold:.3f})."
                ),
            )
        )

    return SanityInfo(
        flagged=bool(reasons),
        fallback_used=False,
        primary_runner="keras_unet_brats",
        primary_volume_cm3=tumor_volume_cm3,
        reasons=reasons,
    )


def _resolve_brats_fallback_model(primary_model: ModelSpec) -> Optional[ModelSpec]:
    if primary_model.task != "brain_tumor_segmentation":
        return None
    if primary_model.modality.upper() != "MRI":
        return None

    bundle_dir = Path(settings.models_dir) / "bundles" / "brats_mri_segmentation"
    weights_path = bundle_dir / "models" / "model.pt"
    config_path = bundle_dir / "configs" / "inference.json"
    metadata_path = bundle_dir / "configs" / "metadata.json"

    if not (weights_path.is_file() and config_path.is_file() and metadata_path.is_file()):
        return None

    return ModelSpec(
        id="brats_mri_segmentation_monai_fallback",
        name="BraTS MRI Segmentation (MONAI fallback)",
        task=primary_model.task,
        modality=primary_model.modality,
        input=["nifti_multi", "dicom_zip"],
        runner="monai_bundle",
        weights_path=str(weights_path),
        description="Automatic MONAI fallback for suspicious U-Net outputs.",
        speed="unknown",
        bundle_dir=str(bundle_dir),
        config_path=str(config_path),
    )


def _write_sanity_to_report(report_path: str, sanity: Optional[SanityInfo]) -> None:
    if sanity is None:
        return
    path = Path(report_path)
    if not path.is_file():
        return
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            return
        payload["sanity"] = sanity.model_dump()
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except (OSError, json.JSONDecodeError):
        return


def _run_job(job_id: str, model: ModelSpec, saved_path: str) -> None:
    _set_job_status(job_id, "running")
    device = "cuda" if torch.cuda.is_available() else "cpu"

    cleanup_paths_list = []
    try:
        input_item, cleanup_paths_list = prepare_input(saved_path, settings.temp_dir)
        output_dir = str(Path(settings.outputs_dir) / job_id)
        mask_path, report_path, tumor_volume_cm3 = _run_inference(
            model=model,
            input_item=input_item,
            output_dir=output_dir,
            job_id=job_id,
            device=device,
        )

        sanity: Optional[SanityInfo] = None
        if model.runner == "keras_unet_brats":
            report_data = _read_report(report_path)
            sanity = _evaluate_keras_unet_sanity(report_data, tumor_volume_cm3)
            fallback_enabled = _is_truthy(
                os.getenv("SEG_SANITY_ENABLE_FALLBACK"), default=True
            )
            if sanity.flagged and fallback_enabled:
                fallback_model = _resolve_brats_fallback_model(model)
                if fallback_model:
                    try:
                        (
                            fallback_mask_path,
                            fallback_report_path,
                            fallback_volume_cm3,
                        ) = _run_inference(
                            model=fallback_model,
                            input_item=input_item,
                            output_dir=output_dir,
                            job_id=job_id,
                            device=device,
                        )
                        sanity.fallback_used = True
                        sanity.fallback_runner = fallback_model.runner
                        sanity.fallback_volume_cm3 = fallback_volume_cm3
                        sanity.reasons.append(
                            SanityReason(
                                code="fallback_executed",
                                message=(
                                    f"Fallback MONAI run used because primary output was "
                                    f"flagged as suspicious."
                                ),
                            )
                        )
                        mask_path = fallback_mask_path
                        report_path = fallback_report_path
                        tumor_volume_cm3 = fallback_volume_cm3
                    except Exception as fallback_exc:  # noqa: BLE001
                        sanity.reasons.append(
                            SanityReason(
                                code="fallback_failed",
                                message=f"Fallback run failed: {fallback_exc}",
                            )
                        )
                else:
                    sanity.reasons.append(
                        SanityReason(
                            code="fallback_unavailable",
                            message=(
                                "Fallback MONAI bundle is not installed; keeping primary output."
                            ),
                        )
                    )

        _write_sanity_to_report(report_path, sanity)
        _set_job_results(job_id, mask_path, report_path, tumor_volume_cm3, sanity=sanity)
    except Exception as exc:  # noqa: BLE001 - surface errors to caller
        _set_job_status(job_id, "error", str(exc))
    finally:
        cleanup_paths(cleanup_paths_list)


@router.post("/segment", response_model=SegmentResponse)
def create_segment_job(payload: SegmentRequest) -> SegmentResponse:
    model = get_model(settings.models_dir, payload.model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    weights_path = Path(model.weights_path)
    if not weights_path.is_file():
        raise HTTPException(
            status_code=400,
            detail="Model weights not found. Install weights to run segmentation.",
        )

    if model.runner == "monai_bundle":
        config_path = (
            Path(model.config_path)
            if model.config_path
            else weights_path.parents[1] / "configs" / "inference.json"
        )
        if not config_path.is_file():
            raise HTTPException(
                status_code=400,
                detail="Bundle inference config not found for this model.",
            )
    elif model.runner == "keras_unet_brats":
        pass
    elif model.runner != "torchscript":
        raise HTTPException(
            status_code=400, detail="Unsupported model runner for this server."
        )

    saved_path = Path(payload.saved_path)
    if not saved_path.exists():
        raise HTTPException(status_code=400, detail="Uploaded file not found")

    job_id = str(uuid4())
    placeholder_outputs = Outputs(mask_path="", report_path="")
    job = ResultsResponse(
        job_id=job_id,
        status="queued",
        model_id=payload.model_id,
        saved_path=payload.saved_path,
        metrics=Metrics(tumor_volume_cm3=0.0),
        outputs=placeholder_outputs,
    )
    with _jobs_lock:
        _jobs[job_id] = job

    worker = threading.Thread(
        target=_run_job, args=(job_id, model, payload.saved_path), daemon=True
    )
    worker.start()

    return SegmentResponse(job_id=job_id)


@router.get("/results/{job_id}", response_model=ResultsResponse)
def get_results(job_id: str) -> ResultsResponse:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job


@router.get("/jobs", response_model=List[JobHistoryItem])
def list_jobs() -> List[JobHistoryItem]:
    items: Dict[str, JobHistoryItem] = {}
    with _jobs_lock:
        for job in _jobs.values():
            items[job.job_id] = _job_to_history(job)

    outputs_dir = Path(settings.outputs_dir)
    if outputs_dir.is_dir():
        report_paths = sorted(
            outputs_dir.glob("*/report.json"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        for report_path in report_paths:
            job_id = report_path.parent.name
            if job_id in items:
                continue
            try:
                data = json.loads(report_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            input_value = data.get("input_path", "")
            if isinstance(input_value, list):
                input_path = ", ".join(str(item) for item in input_value)
            else:
                input_path = str(input_value)
            items[job_id] = JobHistoryItem(
                job_id=str(data.get("job_id") or job_id),
                status="done",
                model_id=str(data.get("model_id", "")),
                input_path=input_path,
                metrics=Metrics(
                    tumor_volume_cm3=float(
                        data.get("tumor_volume_cm3", 0.0) or 0.0
                    )
                ),
                outputs=Outputs(
                    mask_path=str(data.get("mask_path", "")),
                    report_path=str(report_path),
                ),
                sanity=(
                    SanityInfo(**data["sanity"])
                    if isinstance(data.get("sanity"), dict)
                    else None
                ),
                error_message=None,
            )

    return list(items.values())
