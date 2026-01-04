# MedAI Platform (Open Source)

A modular, open-source medical AI platform where clinicians and researchers can upload medical imaging data,
choose from multiple models, compare outputs, and generate results (starting with brain tumor segmentation).

## Stack
- Frontend: React + Vite
- Backend: FastAPI
- Deployment: Docker Compose

## Quick Start (Dev)
```bash
docker compose up --build
```

## GPU (optional)
For NVIDIA GPUs, ensure Docker Desktop uses WSL2 and the NVIDIA driver (WSL support) is installed.

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

The GPU build uses a PyTorch nightly wheel to support newer GPUs. If your driver
does not support the CUDA build listed in `backend/requirements.gpu.txt`, adjust
the index URL to a compatible CUDA version and rebuild.

Verify GPU access:

```bash
docker run --rm --gpus all nvidia/cuda:12.3.2-base-ubuntu22.04 nvidia-smi
```

## Real Segmentation Models (Local Weights)
The backend runs real inference using MONAI pretrained bundles (stored locally).

### Download pretrained bundles
```bash
docker compose exec backend python scripts/download_monai_bundles.py
```

This downloads recommended bundles into `./models/bundles/<bundle_name>/` and the API will show them as available.

### Add any MONAI bundle
```bash
docker compose exec backend python scripts/download_monai_bundles.py brats_mri_segmentation spleen_ct_segmentation
```

List available bundle names:
```bash
docker compose exec backend python scripts/download_monai_bundles.py --list
```

### Notes
- Upload NIfTI files directly, or upload a zipped DICOM series.
- Multi-modal bundles (like BraTS MRI) expect a multi-channel NIfTI or a zip containing multiple NIfTI files.
- The API only enables models whose bundle weights exist.
