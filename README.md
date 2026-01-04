# MedAI Platform (Corpus Medica)

An open source, modular medical AI platform that lets clinicians and researchers upload imaging studies,
choose a segmentation model, and inspect results in a modern UI. This repository is model-agnostic and
ships a working MVP pipeline using MONAI pretrained bundles with locally stored weights.

This README is intentionally detailed: it documents the theory, implementation, and operational details
of everything currently in the repo.

## 1. MVP Workflow (End-to-End)
1) Upload a medical scan (NIfTI or zipped DICOM).
2) Select a segmentation model from the model list.
3) Click "Run Segmentation" to start a job.
4) Backend returns a job_id and starts processing.
5) Frontend polls job status (queued -> running -> done).
6) When done, frontend displays metrics and download links for outputs.

## 2. Theory: What Are Models and Segmentation?
Segmentation is a voxel-level labeling task: each voxel in a 3D scan is assigned a class label,
such as tumor vs. background. The result is a 3D mask volume the same size as the input.

Models in this project are medical imaging neural networks packaged as MONAI bundles. A bundle is a
standardized package that contains:
- The model architecture definition.
- Inference configuration (pre/post-processing).
- Trained weights.
- Metadata describing modality, task, inputs, and expected channels.

Example: The BraTS MRI segmentation bundle expects 4 channels (T1, T1ce, T2, FLAIR) because the model
was trained on multi-modal MRI. Feeding fewer or misaligned modalities leads to errors or invalid results.

## 3. High-Level Architecture
Frontend (React + Vite + TypeScript)
- Single-screen UI in `frontend/src/App.tsx`.
- Styling and animations in `frontend/src/App.css`.
- Polling job status and showing progress, metrics, and outputs.

Backend (FastAPI + MONAI + PyTorch)
- REST API for models, uploads, segmentation, results, and downloads.
- In-memory job store with background threads.
- Real MONAI bundle inference using local weights.

Storage
- Uploads in `/data/uploads`.
- Outputs in `/data/outputs/<job_id>/`.
- Temporary data in `/data/tmp`.
- Model bundles in `/models/bundles`.

## 4. File and Directory Map (Key Pieces)
Backend
- `backend/main.py`: FastAPI app, routers, CORS.
- `backend/config.py`: Settings for upload/output/model/temp directories.
- `backend/app/api/routes/models.py`: Model list endpoint.
- `backend/app/api/routes/uploads.py`: File upload endpoint.
- `backend/app/api/routes/segment.py`: Segmentation job creation and results polling.
- `backend/app/api/routes/files.py`: Download endpoint for outputs.
- `backend/app/services/models_registry.py`: Model registry and bundle discovery.
- `backend/app/services/inference.py`: Inference pipeline (bundle and TorchScript).
- `backend/scripts/download_monai_bundles.py`: Download MONAI model zoo bundles.

Frontend
- `frontend/src/App.tsx`: Full UI logic and state.
- `frontend/src/App.css`: Animations, layout, styling.

Infra
- `docker-compose.yml`: Base services (backend + frontend).
- `docker-compose.gpu.yml`: GPU override for backend (optional).
- `backend/Dockerfile`: CPU build.
- `backend/Dockerfile.gpu`: GPU build.
- `backend/requirements.txt`: CPU torch.
- `backend/requirements.gpu.txt`: GPU torch nightly for newer GPUs.

## 5. API Reference (Current Endpoints)
All endpoints are under `/api`.

### GET /api/health
Simple health check.

### GET /api/models
Returns available models, including those discovered from local MONAI bundles.
Response:
```json
{
  "models": [
    {
      "id": "brats_mri_segmentation",
      "name": "BraTS MRI Segmentation",
      "type": "segmentation",
      "speed": "unknown",
      "task": "brain_tumor_segmentation",
      "modality": "MRI",
      "input": ["nifti_multi", "dicom_zip"],
      "description": "BraTS brain tumor segmentation (multi-modal MRI).",
      "available": true
    }
  ]
}
```

### POST /api/uploads
Multipart upload. Returns a server-side saved path.
Response:
```json
{
  "filename": "case.nii.gz",
  "saved_path": "/data/uploads/case.nii.gz"
}
```

### POST /api/segment
Start a segmentation job.
Request:
```json
{
  "saved_path": "/data/uploads/case.nii.gz",
  "model_id": "brats_mri_segmentation"
}
```
Response:
```json
{ "job_id": "uuid" }
```

### GET /api/results/{job_id}
Poll job status and results.
Response:
```json
{
  "job_id": "uuid",
  "status": "queued|running|done|error",
  "model_id": "brats_mri_segmentation",
  "saved_path": "/data/uploads/case.nii.gz",
  "metrics": { "tumor_volume_cm3": 12.3 },
  "outputs": {
    "mask_path": "/data/outputs/<job_id>/.../mask.nii.gz",
    "report_path": "/data/outputs/<job_id>/report.json"
  },
  "error_message": "string or null"
}
```

### GET /api/download?path=...
Downloads output files from `/data/outputs`. The path must be inside outputs.
Example:
```
http://localhost:8000/api/download?path=/data/outputs/<job_id>/.../mask.nii.gz
```

## 6. Model Registry and Bundle Discovery
The model registry merges three sources:
1) Default bundles (currently BraTS MRI and Spleen CT).
2) Any local bundles under `/models/bundles/*`.
3) Optional `models/registry.json` for custom models.

Bundle discovery reads:
- `configs/metadata.json` for name/task/modality/description.
- `configs/inference.json` for input channels.

The API flags a model as `available` only if the weights exist at `models/bundles/<id>/models/model.pt`.

## 7. Inference Pipeline (Detailed)
The backend supports two runners:
1) MONAI bundles (`runner = "monai_bundle"`).
2) TorchScript models (`runner = "torchscript"`).

Input handling:
- NIfTI (`.nii` / `.nii.gz`) is accepted directly.
- DICOM (folder or zip) is converted to NIfTI using `dicom2nifti`.
- Zip files can contain multiple NIfTI files.

Multi-modal input:
- If the model expects multiple channels (e.g., BraTS expects 4), the backend accepts:
  - A single 4-channel NIfTI, or
  - A zip with 4 aligned NIfTI files.
- The backend validates shape and affine alignment across modalities.
- It stacks modalities into a multi-channel NIfTI (channel-last) and forces channel-first loading.

Validation:
- Enforces expected channel count.
- Rejects mismatched shapes/affines.
- Rejects unsupported formats.

Bundle execution:
- Uses `monai.bundle.scripts.run` with runtime overrides:
  - `bundle_root`, `output_dir`
  - datalist injection with the uploaded file(s)
  - `device` selection
  - `dataloader#num_workers = 0` to avoid multi-process crashes in Docker
  - `checkpointloader#map_location` on CPU
  - channel-first enforcement if needed

TorchScript execution:
- Loads the TorchScript model and runs either direct inference or sliding window.
- Outputs a binary or argmax mask and a JSON report.

## 8. Outputs and Metrics
Outputs:
- `mask.nii.gz` (segmentation mask)
- `report.json` (job metadata + computed metrics)

The default metric is a simple tumor volume estimate:
```
tumor_volume_cm3 = number_of_mask_voxels * voxel_volume_mm3 / 1000
```

This is a placeholder metric and not a clinical measurement.

## 9. Frontend UI Behavior
The UI is intentionally a single-file frontend:
- `App.tsx` contains all logic and state.
- `App.css` contains all styles and animations.

UI features:
- Hero header with workflow summary.
- Model cards with hover and selection states.
- Upload dropzone feel and upload status.
- Segmentation timeline, progress bar, and status badges.
- Skeletons and shimmer loading.
- Toast notifications for success/failure.
- Results panel with downloads.
- Disclaimer footer.

## 10. GPU and CPU Support
By default, the CPU image uses:
```
backend/requirements.txt
```
This installs `torch==2.2.2+cpu`.

GPU support uses a separate build:
```
backend/requirements.gpu.txt
backend/Dockerfile.gpu
docker-compose.gpu.yml
```

### GPU build command
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

### Verify GPU inside container
```bash
docker compose exec backend python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
```

### GPU compatibility
Some GPUs (newer architectures) require PyTorch nightly wheels. The GPU requirements file uses a
nightly CUDA index so that newer cards (e.g., sm_120) can run.

### Memory tuning
BraTS uses large ROI sizes and may OOM on small GPUs. The backend auto-adjusts ROI size based on GPU
memory. You can override it manually with:
```
MONAI_ROI_SIZE=128,128,128
```

## 11. Common Errors and Fixes
1) "Model expects 4 channels but got 1"
   - You are running BraTS with a single modality. Provide T1, T1ce, T2, FLAIR.

2) "All modalities must share the same shape and voxel grid"
   - Your modalities are not aligned. Resample/align them first.

3) "DataLoader worker exited unexpectedly"
   - Fixed by forcing `num_workers=0` in bundle overrides.

4) "CUDA error: no kernel image is available"
   - Your GPU is newer than the installed PyTorch build. Use the GPU build with nightly wheels.

5) "CUDA out of memory"
   - Reduce ROI size or use CPU inference.

## 12. Evaluation and Accuracy Checks
True accuracy requires ground-truth masks. Without GT, you can only visually inspect overlays in tools
like 3D Slicer or ITK-SNAP.

Example Dice evaluation (requires GT):
```bash
docker compose exec backend python -c "import nibabel as nib, numpy as np; pred=nib.load('/data/outputs/JOB/mask.nii.gz').get_fdata()>0; gt=nib.load('/data/uploads/GT_MASK.nii.gz').get_fdata()>0; inter=(pred & gt).sum(); dice=(2.0*inter)/(pred.sum()+gt.sum()+1e-8); print('Dice:', dice)"
```

## 13. Running the Project (CPU)
```bash
docker compose up --build
```

The frontend runs at:
```
http://localhost:5173
```

The backend runs at:
```
http://localhost:8000
```

## 14. Downloading Models (MONAI Bundles)
Download recommended bundles:
```bash
docker compose exec backend python scripts/download_monai_bundles.py
```

List available bundle names:
```bash
docker compose exec backend python scripts/download_monai_bundles.py --list
```

Download specific bundles:
```bash
docker compose exec backend python scripts/download_monai_bundles.py brats_mri_segmentation spleen_ct_segmentation
```

## 15. Data Formats Supported
- NIfTI: `.nii`, `.nii.gz`
- DICOM series: directory or zip
- Multi-modal NIfTI: single multi-channel NIfTI or zip with multiple NIfTI files

## 16. Storage Locations
- Uploads: `/data/uploads`
- Outputs: `/data/outputs/<job_id>/`
- Temp: `/data/tmp`
- Models: `/models/bundles`

`models/` is gitignored to prevent large weights from being committed.

## 17. Security and Compliance Notes
- This project is for research and decision support only. Not for medical diagnosis.
- No authentication is implemented. Do not expose this to the public internet.
- The download endpoint is restricted to `/data/outputs` but is otherwise open.
- Do not upload PHI unless running in a compliant environment.

## 18. Development Notes
- Backend uses `uvicorn --reload`. If code changes while a job is running, the job may be lost.
- Jobs are stored in memory only. Restarting the backend clears job history.

## 19. Roadmap Ideas (Not Implemented Yet)
- Persistent job storage (database or Redis).
- Auth and user access control.
- Advanced metrics and evaluation endpoints.
- Real download links with authorization.
- Model comparison UI.
- Model registration and registry UI.

## 20. License
See `LICENSE`.
