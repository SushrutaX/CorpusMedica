# Segmentation Pipeline

## Model registry
The backend discovers models from MONAI bundles and optional registry data.
Each bundle provides:
- `configs/metadata.json` for task and modality
- `configs/inference.json` for input channels and transforms
- `models/model.pt` for weights

A model is marked available only when weights exist on disk.

## Input handling
Supported inputs:
- NIfTI (.nii, .nii.gz)
- DICOM directory or zip
- Multi-modal zip of aligned NIfTI files

Validation checks:
- Correct channel count for the model
- Matching shape and affine across modalities
- Supported file types only

## Bundle runner flow
1) Prepare input path (convert DICOM if needed).
2) Validate channels and alignment.
3) If multiple NIfTI files are provided, stack into a multi-channel volume.
4) Call `monai.bundle.scripts.run` with runtime overrides:
   - bundle_root
   - output_dir
   - injected datalist
   - device selection
   - num_workers = 0 for stability in Docker

## TorchScript runner flow
1) Load volume and normalize intensity.
2) Run direct or sliding-window inference.
3) Write mask and report JSON.

## Job lifecycle
Jobs are created by `/api/segment` and tracked in memory. Typical states:
- `queued`
- `running`
- `done`
- `error`

## Outputs
Each job writes to `/data/outputs/<job_id>` and produces:
- A mask volume (`*.nii.gz`)
- A JSON report with metrics

## Metrics
Default metric is a volume estimate based on voxel count:

```
volume_cm3 = mask_voxels * voxel_volume_mm3 / 1000
```

## Common failures
- Channel mismatch for BraTS models
- Misaligned modalities in a zip
- GPU OOM for large ROI sizes
