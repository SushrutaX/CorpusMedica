# Viewers (2D and 3D)

## 2D slices viewer
The 2D viewer renders slices by calling backend endpoints.

### Data flow
1) Frontend fetches `/api/uploads/volume-info` to get shape and channels.
2) User selects axis and slice index.
3) Frontend requests `/api/uploads/slice` with axis, index, channel, and colormap.
4) Backend returns a PNG slice.
5) Frontend updates the view.

### UI behavior
- Axis tabs switch between axial, coronal, and sagittal.
- Sliders clamp to the volume shape for each axis.
- Colormap selection is sent to the backend to keep rendering consistent.
- Optional prefetch logic reduces lag while scrubbing.

## 3D volume viewer
The 3D volume viewer uses a WebGL pipeline with vtk.js.

### Data flow
1) Frontend requests `/api/uploads/volume-file` for the current channel.
2) NIfTI is loaded into a VTK image data object.
3) A volume mapper and volume actor are created.
4) Transfer functions map intensity to color and opacity.
5) The renderer updates the viewport.

### UI controls
- Rotate, zoom, pan
- Opacity slider and colormap preset
- Clipping axis and slider for interior inspection

### Performance notes
- The viewer is lazily initialized on first use.
- Volume reloads are minimized by caching state.
- Downsampling and colormap adjustments happen without full reinit where possible.

## Sync behavior
Viewer state is tied to the selected upload path and channel, ensuring the backend and UI stay aligned.
