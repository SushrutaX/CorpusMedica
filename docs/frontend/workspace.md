# Workspace

The workspace is a dedicated area for deeper 2D and 3D exploration.

## Layout
- Fullscreen 3D viewport for mesh or volume
- Floating left and right shelves for tools
- Snap, drag, and resize behavior

## 3D mesh workspace
Mesh is generated from volume data via `/api/uploads/mesh`.

### Mesh pipeline
1) Frontend requests a PLY mesh with iso and step parameters.
2) The PLY is parsed and converted to a renderable geometry.
3) Materials and lights are applied based on presets.
4) Optional overlay meshes are loaded for segmentation results.

### Current controls
- Mesh source: scan or segmentation mask
- Overlay mesh: adjustable opacity and iso
- Iso and step controls for mesh quality
- Clipping controls by axis
- Explode and isolate tools
- Material presets and wireframe toggle
- Orbit, pan, zoom controls

### Use cases
- Inspect organ shape and surface detail
- Compare segmentation output against scan mesh
- Reveal internal structures using clipping

## 2D workspace
Tools:
- Brush and erase
- Rectangle ROI
- Measurement helpers
- Label palette and opacity

## Annotations
The workspace stores annotation state in memory and can export results for later review.
