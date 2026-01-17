# Uploads and Volume IO

This module powers 2D and 3D viewing and provides a clean interface to stored scans.

## Path resolution and safety
All viewer endpoints call a resolver that ensures the requested `path` lives under:
- `/data/uploads`
- `/data/outputs`

Requests outside those roots are rejected.

## Upload and preview
- `/api/uploads` stores a file and returns a saved path.
- `/api/uploads/preview` inspects the path and returns a structured preview.

Preview responses include the kind of file and warnings if the contents are not supported.

## Volume metadata
`/api/uploads/volume-info` returns:
- `shape`: x, y, z
- `channels`: number of channels
- `zooms`: voxel spacing

The frontend uses this to set slider limits and channel dropdowns.

## Volume files for 3D rendering
`/api/uploads/volume-file` serves a NIfTI file for a given channel.

Key behavior:
- `.nii.gz` is uncompressed for the viewer if needed.
- If the volume is 4D, a temporary single-channel NIfTI is created for the selected channel.
- If the input is a zip, it is extracted to a temp directory first.
- If the input is DICOM, it is converted to NIfTI using `dicom2nifti`.

## Slice rendering
`/api/uploads/slice` returns a PNG image for:
- axis: axial, coronal, sagittal
- index: slice index
- channel: channel index
- colormap: grayscale, hot, cool, viridis, etc

The backend:
1) Parses axis and clamps index.
2) Loads the slice data.
3) Normalizes intensity.
4) Applies the colormap.
5) Returns a PNG.

## Mesh generation
`/api/uploads/mesh` runs an iso-surface extraction and returns a PLY mesh.

Key parameters:
- `iso`: threshold used in marching cubes
- `step`: downsample step for speed
- `label`: optional mask value to extract

The mesh is generated from a single channel volume and returned as a binary PLY for the frontend to load.

## Caching and temp files
Zip extraction and DICOM conversion use temporary directories under `/data/tmp`. These are cleaned after use.
