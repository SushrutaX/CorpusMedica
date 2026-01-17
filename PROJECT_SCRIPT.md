# Corpus Medica Project Walkthrough Script

This is a plain-language narration you can read as a speech or use as a demo script.
It focuses on the full project scope with special detail on the 2D/3D viewers and the 3D mesh workspace.

---

## 1) What this project is

Corpus Medica is an open-source, model-agnostic medical AI platform. The main idea is to make medical imaging workflows simple and modular:

- Upload a scan (NIfTI or DICOM).
- Choose a segmentation model.
- Run segmentation and track the job status.
- Explore results in a clean UI, with 2D slices and 3D volume/mesh views.

The backend is built so we can plug in different AI models without changing the front end. The frontend focuses on fast visualization and clear interaction rather than heavy UI frameworks.

---

## 2) How the imaging flow works (end-to-end)

1) **Upload**  
   Users upload a scan file. The backend stores it and returns a saved path.

2) **Model selection**  
   The frontend fetches available models from the backend and shows them as selectable cards.

3) **Segmentation run**  
   The user clicks “Run Segmentation.” The backend creates a job, runs inference (or simulation), and writes outputs to the outputs folder.

4) **Results**  
   The frontend polls the job endpoint and, when finished, displays metrics and output paths.  
   The segmentation mask can be used to drive a 3D mesh overlay or a dedicated mesh source.

---

## 3) 2D slices viewer (how it works)

### Data path
- The frontend requests slice images from backend endpoints.
- The backend loads the NIfTI (or DICOM converted to NIfTI), extracts a specific axial/coronal/sagittal slice, and returns an image.

### Rendering
- The UI displays slices as images with a responsive layout.
- Sliders control axis and index.
- Colormap can be applied on the backend to keep the frontend lightweight.

### Why this approach
- It keeps the frontend simple and stable.
- It avoids loading huge volumes into the browser for basic slice review.
- It works on both CPU and GPU builds.

---

## 4) 3D volume viewer (how it works)

### Data path
- The frontend requests a volume file (or a single channel) from the backend.
- The backend serves a NIfTI file that the frontend can load.

### Rendering
- The frontend uses a WebGL-based renderer to visualize the 3D volume.
- A transfer function maps voxel intensity to color and opacity.
- The user can rotate, zoom, and pan.

### Why this matters
- This gives clinicians and researchers a full spatial view of anatomy.
- It creates a consistent experience on desktop and laptop hardware.

---

## 5) 3D mesh workspace (how we build mesh from volume)

### Mesh generation pipeline
1) **Volume loading**  
   The backend loads the 3D voxel grid from a NIfTI file.

2) **Iso-surface extraction**  
   We run a marching-cubes style extraction (iso-surface) to turn voxel intensity into a surface mesh.

3) **Mesh export**  
   The backend returns a mesh file that the frontend can load.

4) **Frontend rendering**  
   The frontend loads the mesh, positions it in the scene, and applies material, lights, and camera controls.

### Why this is powerful
This turns raw voxel data into a clean 3D surface that can be:
- Rotated and inspected from any angle.
- Overlayed with a segmentation mesh to highlight tumors or organs.
- Clipped and styled for better visibility.

---

## 6) Current mesh tools

Today, the mesh workspace includes:

- **Mesh Source switch**  
  Choose whether the mesh is built from the raw scan or from the segmentation mask.

- **Tumor overlay mesh**  
  If a segmentation mask exists, we can overlay it as a semi-transparent mesh on top of the scan mesh.

- **Opacity control**  
  Adjust how strong the overlay appears so it does not hide anatomy.

- **Iso/Step controls**  
  Tune the iso threshold and extraction step size for clarity and performance.

- **Clipping controls**  
  Cut through the mesh to inspect internal structures.

- **Orbit + pan + zoom**  
  Smooth navigation inside the 3D workspace.

---

## 7) What the workspace is for

The 3D workspace is designed as a medical imaging “studio.”  
It allows:

- Visual inspection of complex anatomy.
- Fast review of segmentation output quality.
- Interactive exploration of pathological regions.

This is especially helpful for:
- Tumor boundary checks
- Multi-organ segmentation review
- Pre-operative planning visualizations

---

## 8) How far we can take this in the future

Here are realistic upgrade paths:

1) **Advanced segmentation overlays**  
   Multiple labels and color maps, with label toggles.

2) **Annotation layers**  
   Marking suspicious regions, text notes, and manual segmentation tools.

3) **Quantitative analytics**  
   Automated volume, diameter, and growth trend calculations.

4) **Multi-volume comparison**  
   Compare pre- and post-treatment scans in the same scene.

5) **GPU-optimized streaming**  
   Faster 3D volume streaming for very large scans.

6) **AI explainability**  
   Local heatmaps or saliency overlays for model reasoning.

7) **Collaboration**  
   Multiple users viewing and annotating the same case in real time.

---

## 9) Closing line (optional)

Corpus Medica is built to be modular, medical-grade, and future-ready.  
We already have a full upload-to-segmentation pipeline, a responsive 2D/3D viewer system, and a robust 3D mesh workspace.  
From here, we can evolve into a complete medical imaging studio with analysis, collaboration, and clinical-grade tooling.
