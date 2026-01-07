import json
import threading
from pathlib import Path
from typing import Dict, List, Literal, Optional
from uuid import uuid4

import torch
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings
from app.services.inference import (
    cleanup_paths,
    prepare_input,
    run_monai_bundle,
    run_torchscript,
)
from app.services.models_registry import ModelSpec, get_model

router = APIRouter()

JobStatus = Literal["queued", "running", "done", "error"]


class SegmentRequest(BaseModel):
    saved_path: str
    model_id: str


class SegmentResponse(BaseModel):
    job_id: str


class Metrics(BaseModel):
    tumor_volume_cm3: float


class Outputs(BaseModel):
    mask_path: str
    report_path: str


class ResultsResponse(BaseModel):
    job_id: str
    status: JobStatus
    model_id: str
    saved_path: str
    metrics: Metrics
    outputs: Outputs
    error_message: Optional[str] = None


_jobs: Dict[str, ResultsResponse] = {}
_jobs_lock = threading.Lock()


class JobHistoryItem(BaseModel):
    job_id: str
    status: JobStatus
    model_id: str
    input_path: str
    metrics: Metrics
    outputs: Outputs
    error_message: Optional[str] = None


def _job_to_history(job: ResultsResponse) -> JobHistoryItem:
    return JobHistoryItem(
        job_id=job.job_id,
        status=job.status,
        model_id=job.model_id,
        input_path=job.saved_path,
        metrics=job.metrics,
        outputs=job.outputs,
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
) -> None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job.status = "done"
        job.metrics = Metrics(tumor_volume_cm3=tumor_volume_cm3)
        job.outputs = Outputs(mask_path=mask_path, report_path=report_path)
        job.error_message = None


def _run_job(job_id: str, model: ModelSpec, saved_path: str) -> None:
    _set_job_status(job_id, "running")
    device = "cuda" if torch.cuda.is_available() else "cpu"

    cleanup_paths_list = []
    try:
        input_item, cleanup_paths_list = prepare_input(saved_path, settings.temp_dir)
        output_dir = str(Path(settings.outputs_dir) / job_id)
        if model.runner == "monai_bundle":
            mask_path, report_path, tumor_volume_cm3 = run_monai_bundle(
                model=model,
                input_item=input_item,
                output_dir=output_dir,
                job_id=job_id,
                device=device,
            )
        elif model.runner == "torchscript":
            if isinstance(input_item, list):
                raise ValueError("TorchScript runner expects a single NIfTI file.")
            mask_path, report_path, tumor_volume_cm3 = run_torchscript(
                model=model,
                input_path=input_item,
                output_dir=output_dir,
                job_id=job_id,
                device=device,
            )
        else:
            raise ValueError("Unsupported model runner for this server.")
        _set_job_results(job_id, mask_path, report_path, tumor_volume_cm3)
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
                error_message=None,
            )

    return list(items.values())
