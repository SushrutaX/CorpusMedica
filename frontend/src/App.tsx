import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

type Model = {
  id: string;
  name: string;
  type: string;
  speed: string;
  task: string;
  modality: string;
  input: string[];
  description: string;
  available: boolean;
};

type ModelsResponse = {
  models: Model[];
};

type UploadSingleResponse = {
  filename: string;
  saved_path: string;
  kind?: string;
};

type UploadBatchResponse = {
  filenames: string[];
  saved_path: string;
  kind: string;
};

type UploadResponse = UploadSingleResponse | UploadBatchResponse;

type SegmentResponse = {
  job_id: string;
};

type JobStatus = "queued" | "running" | "done" | "error";

type ResultsResponse = {
  job_id: string;
  status: JobStatus;
  model_id: string;
  saved_path: string;
  metrics: {
    tumor_volume_cm3: number;
  };
  outputs: {
    mask_path: string;
    report_path: string;
  };
  error_message?: string | null;
};

type UploadPreview = {
  kind: string;
  files?: Array<{
    name: string;
    shape?: number[];
    zooms?: number[];
    dtype?: string;
  }>;
  dicom?: {
    slices?: number;
    rows?: number;
    cols?: number;
    pixel_spacing?: number[] | null;
    slice_thickness?: number | null;
    modality?: string;
  };
  warnings?: string[];
};

type VolumeInfo = {
  shape: number[];
  channels: number;
  zooms?: number[];
};

type JobHistoryItem = {
  job_id: string;
  status: JobStatus;
  model_id: string;
  input_path: string;
  metrics: {
    tumor_volume_cm3: number;
  };
  outputs: {
    mask_path: string;
    report_path: string;
  };
  error_message?: string | null;
};

type Notice = {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
};

type AxisKey = "sagittal" | "coronal" | "axial";

type SliceIndex = Record<AxisKey, number>;

type ViewerMode = "2d" | "3d";
type SliceColorMap = "grayscale" | "bone" | "hot" | "cool" | "viridis";
type VolumeColorMap =
  | "radiance"
  | "grayscale"
  | "bone"
  | "hot"
  | "cool"
  | "viridis";

const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";

const SKELETONS = Array.from({ length: 3 }, (_, index) => index);
const buildDownloadUrl = (path: string) =>
  `${API_BASE}/api/download?path=${encodeURIComponent(path)}`;
const enable3DViewer =
  ((import.meta.env.VITE_ENABLE_3D_VIEWER as string) ?? "true") === "true";
const SLICE_COLORMAPS: Array<{ id: SliceColorMap; label: string }> = [
  { id: "grayscale", label: "Grayscale" },
  { id: "bone", label: "Bone" },
  { id: "hot", label: "Hot" },
  { id: "cool", label: "Cool" },
  { id: "viridis", label: "Viridis" },
];
const VOLUME_COLORMAPS: Array<{ id: VolumeColorMap; label: string }> = [
  { id: "radiance", label: "Radiance" },
  { id: "grayscale", label: "Grayscale" },
  { id: "bone", label: "Bone" },
  { id: "hot", label: "Hot" },
  { id: "cool", label: "Cool" },
  { id: "viridis", label: "Viridis" },
];
const VOLUME_COLOR_STOPS: Record<
  VolumeColorMap,
  Array<[number, [number, number, number]]>
> = {
  radiance: [
    [0, [0.0, 0.0, 0.0]],
    [0.5, [0.55, 0.7, 0.95]],
    [0.85, [0.95, 0.55, 0.35]],
    [1, [1.0, 1.0, 1.0]],
  ],
  grayscale: [
    [0, [0.0, 0.0, 0.0]],
    [1, [1.0, 1.0, 1.0]],
  ],
  bone: [
    [0, [0.0, 0.0, 0.0]],
    [0.4, [0.55, 0.62, 0.7]],
    [0.8, [0.85, 0.9, 0.95]],
    [1, [1.0, 1.0, 1.0]],
  ],
  hot: [
    [0, [0.0, 0.0, 0.0]],
    [0.3, [0.8, 0.0, 0.0]],
    [0.6, [1.0, 0.6, 0.0]],
    [1, [1.0, 1.0, 1.0]],
  ],
  cool: [
    [0, [0.0, 1.0, 1.0]],
    [1, [1.0, 0.0, 1.0]],
  ],
  viridis: [
    [0, [0.267, 0.004, 0.329]],
    [0.25, [0.283, 0.141, 0.458]],
    [0.5, [0.254, 0.265, 0.53]],
    [0.75, [0.163, 0.471, 0.558]],
    [1, [0.993, 0.906, 0.144]],
  ],
};

export default function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState<boolean>(false);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [volumeInfo, setVolumeInfo] = useState<VolumeInfo | null>(null);
  const [viewerLoading, setViewerLoading] = useState<boolean>(false);
  const [viewerError, setViewerError] = useState<string>("");
  const [viewerMode, setViewerMode] = useState<ViewerMode>(
    enable3DViewer ? "3d" : "2d"
  );
  const [viewer3dLoading, setViewer3dLoading] = useState<boolean>(false);
  const [viewer3dError, setViewer3dError] = useState<string>("");
  const [sliceColormap, setSliceColormap] =
    useState<SliceColorMap>("grayscale");
  const [volumeColormap, setVolumeColormap] =
    useState<VolumeColorMap>("radiance");
  const [sliceIndex, setSliceIndex] = useState<SliceIndex>({
    sagittal: 0,
    coronal: 0,
    axial: 0,
  });
  const [viewerChannel, setViewerChannel] = useState<number>(0);
  const [jobId, setJobId] = useState<string>("");
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [jobResult, setJobResult] = useState<ResultsResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [jobHistory, setJobHistory] = useState<JobHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string>("");
  const [notices, setNotices] = useState<Notice[]>([]);

  const viewerRef = useRef<HTMLDivElement | null>(null);
  const viewerCleanupRef = useRef<(() => void) | null>(null);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) || null,
    [models, selectedModelId]
  );
  const availableModels = useMemo(
    () => models.filter((model) => model.available),
    [models]
  );
  const recentJobs = useMemo(() => jobHistory.slice(0, 6), [jobHistory]);
  const uploadPath = uploadResult?.saved_path ?? "";

  const pushNotice = useCallback(
    (type: Notice["type"], title: string, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const notice = { id, type, title, message };
      setNotices((prev) => [...prev, notice]);
      window.setTimeout(() => {
        setNotices((prev) => prev.filter((item) => item.id !== id));
      }, 4200);
    },
    []
  );

  useEffect(() => {
    let active = true;

    async function loadModels() {
      try {
        setError("");
        setModelsLoading(true);
        const res = await fetch(`${API_BASE}/api/models`);
        if (!res.ok) throw new Error(`Models API failed (${res.status})`);
        const data = (await res.json()) as ModelsResponse;
        if (!active) return;
        setModels(Array.isArray(data.models) ? data.models : []);
      } catch (e: unknown) {
        if (!active) return;
        const message =
          e instanceof Error ? e.message : "Failed to load models";
        setError(message);
        pushNotice("error", "Models unavailable", message);
      } finally {
        if (active) setModelsLoading(false);
      }
    }

    loadModels();
    return () => {
      active = false;
    };
  }, [pushNotice]);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryError("");
      setHistoryLoading(true);
      const res = await fetch(`${API_BASE}/api/jobs`);
      if (!res.ok) throw new Error(`Jobs API failed (${res.status})`);
      const data = (await res.json()) as JobHistoryItem[];
      setJobHistory(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to load job history";
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (jobStatus === "done") {
      loadHistory();
    }
  }, [jobStatus, loadHistory]);

  const fetchVolumeInfo = useCallback(async (path: string) => {
    try {
      setViewerError("");
      setViewerLoading(true);
      const res = await fetch(
        `${API_BASE}/api/uploads/volume-info?path=${encodeURIComponent(path)}`
      );
      if (!res.ok) throw new Error(`Viewer API failed (${res.status})`);
      const data = (await res.json()) as VolumeInfo;
      setVolumeInfo(data);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to load volume metadata.";
      setViewerError(message);
      setVolumeInfo(null);
    } finally {
      setViewerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!uploadPath) {
      setVolumeInfo(null);
      setViewerError("");
      return;
    }
    fetchVolumeInfo(uploadPath);
  }, [fetchVolumeInfo, uploadPath]);

  useEffect(() => {
    if (!volumeInfo || volumeInfo.shape.length < 3) return;
    setSliceIndex({
      sagittal: Math.floor(volumeInfo.shape[0] / 2),
      coronal: Math.floor(volumeInfo.shape[1] / 2),
      axial: Math.floor(volumeInfo.shape[2] / 2),
    });
    setViewerChannel(0);
  }, [volumeInfo]);

  const buildVolumeFileUrl = useCallback(() => {
    if (!uploadPath) return "";
    const params = new URLSearchParams({
      path: uploadPath,
      channel: String(viewerChannel),
      t: String(Date.now()),
    });
    return `${API_BASE}/api/uploads/volume-file?${params.toString()}`;
  }, [uploadPath, viewerChannel]);

  useEffect(() => {
    if (!enable3DViewer || viewerMode !== "3d") {
      if (viewerCleanupRef.current) {
        viewerCleanupRef.current();
        viewerCleanupRef.current = null;
      }
      setViewer3dLoading(false);
      setViewer3dError("");
      return;
    }
    if (!uploadPath || !viewerRef.current) {
      if (viewerCleanupRef.current) {
        viewerCleanupRef.current();
        viewerCleanupRef.current = null;
      }
      setViewer3dLoading(false);
      return;
    }

    let cancelled = false;
    setViewer3dError("");
    setViewer3dLoading(true);

    const container = viewerRef.current;
    container.replaceChildren();

    const initViewer = async () => {
      try {
        // @ts-expect-error vtk.js has no bundled types
        const vtkRenderWindowModule = await import(
          "vtk.js/Sources/Rendering/Core/RenderWindow"
        );
        // @ts-expect-error vtk.js has no bundled types
        const vtkRendererModule = await import(
          "vtk.js/Sources/Rendering/Core/Renderer"
        );
        // @ts-expect-error vtk.js has no bundled types
        await import("vtk.js/Sources/Rendering/OpenGL/Renderer");
        // @ts-expect-error vtk.js has no bundled types
        await import("vtk.js/Sources/Rendering/OpenGL/Camera");
        // @ts-expect-error vtk.js has no bundled types
        const vtkOpenGLRenderWindowModule = await import(
          "vtk.js/Sources/Rendering/OpenGL/RenderWindow"
        );
        // @ts-expect-error vtk.js has no bundled types
        await import("vtk.js/Sources/Rendering/OpenGL/Volume");
        // @ts-expect-error vtk.js has no bundled types
        await import("vtk.js/Sources/Rendering/OpenGL/VolumeMapper");
        // @ts-expect-error vtk.js has no bundled types
        const vtkRenderWindowInteractorModule = await import(
          "vtk.js/Sources/Rendering/Core/RenderWindowInteractor"
        );
        // @ts-expect-error vtk.js has no bundled types
        const vtkInteractorStyleTrackballCameraModule = await import(
          "vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera"
        );
        // @ts-expect-error vtk.js has no bundled types
        const vtkVolumeModule = await import(
          "vtk.js/Sources/Rendering/Core/Volume"
        );
        // @ts-expect-error vtk.js has no bundled types
        const vtkVolumeMapperModule = await import(
          "vtk.js/Sources/Rendering/Core/VolumeMapper"
        );
        // @ts-expect-error vtk.js has no bundled types
        const vtkColorTransferFunctionModule = await import(
          "vtk.js/Sources/Rendering/Core/ColorTransferFunction"
        );
        // @ts-expect-error vtk.js has no bundled types
        const vtkPiecewiseFunctionModule = await import(
          "vtk.js/Sources/Common/DataModel/PiecewiseFunction"
        );
        // @ts-expect-error vtk.js has no bundled types
        const vtkImageDataModule = await import(
          "vtk.js/Sources/Common/DataModel/ImageData"
        );
        // @ts-expect-error vtk.js has no bundled types
        const vtkDataArrayModule = await import(
          "vtk.js/Sources/Common/Core/DataArray"
        );
        // @ts-expect-error nifti-reader-js has no bundled types
        const niftiModule = await import("nifti-reader-js");

        if (cancelled) return;

        const vtkRenderWindow = vtkRenderWindowModule.default;
        const vtkRenderer = vtkRendererModule.default;
        const vtkOpenGLRenderWindow = vtkOpenGLRenderWindowModule.default;
        const vtkRenderWindowInteractor =
          vtkRenderWindowInteractorModule.default;
        const vtkInteractorStyleTrackballCamera =
          vtkInteractorStyleTrackballCameraModule.default;
        const vtkVolume = vtkVolumeModule.default;
        const vtkVolumeMapper = vtkVolumeMapperModule.default;
        const vtkColorTransferFunction =
          vtkColorTransferFunctionModule.default;
        const vtkPiecewiseFunction = vtkPiecewiseFunctionModule.default;
        const vtkImageData = vtkImageDataModule.default;
        const vtkDataArray = vtkDataArrayModule.default;
        const nifti = niftiModule;

        const renderWindow = vtkRenderWindow.newInstance();
        const renderer = vtkRenderer.newInstance();
        renderWindow.addRenderer(renderer);

        const openGLRenderWindow = vtkOpenGLRenderWindow.newInstance();
        openGLRenderWindow.setContainer(container);
        renderWindow.addView(openGLRenderWindow);

        const interactor = vtkRenderWindowInteractor.newInstance();
        interactor.setView(openGLRenderWindow);
        interactor.setInteractorStyle(
          vtkInteractorStyleTrackballCamera.newInstance()
        );
        interactor.initialize();
        interactor.bindEvents(container);

        renderer.setBackground(0.97, 0.98, 1);

        const response = await fetch(buildVolumeFileUrl());
        if (!response.ok) {
          throw new Error(`Volume download failed (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        let buffer = arrayBuffer;
        if (nifti.isCompressed(buffer)) {
          buffer = nifti.decompress(buffer);
        }
        if (!nifti.isNIFTI(buffer)) {
          throw new Error("Unsupported volume file format.");
        }
        const header = nifti.readHeader(buffer);
        const image = nifti.readImage(header, buffer);

        const toFloat32 = () => {
          const datatype = header.datatypeCode;
          const slope =
            typeof header.scl_slope === "number" && header.scl_slope !== 0
              ? header.scl_slope
              : 1;
          const intercept =
            typeof header.scl_inter === "number" ? header.scl_inter : 0;

          const volumeSize =
            Number(header.dims[1]) *
            Number(header.dims[2]) *
            Number(header.dims[3]);

          const makeArray = () => {
            switch (datatype) {
              case nifti.NIFTI1.TYPE_UINT8:
                return new Uint8Array(image);
              case nifti.NIFTI1.TYPE_INT16:
                return new Int16Array(image);
              case nifti.NIFTI1.TYPE_INT32:
                return new Int32Array(image);
              case nifti.NIFTI1.TYPE_FLOAT32:
                return new Float32Array(image);
              case nifti.NIFTI1.TYPE_FLOAT64:
                return new Float64Array(image);
              case nifti.NIFTI1.TYPE_INT8:
                return new Int8Array(image);
              case nifti.NIFTI1.TYPE_UINT16:
                return new Uint16Array(image);
              case nifti.NIFTI1.TYPE_UINT32:
                return new Uint32Array(image);
              case nifti.NIFTI1.TYPE_INT64:
                return new BigInt64Array(image);
              case nifti.NIFTI1.TYPE_UINT64:
                return new BigUint64Array(image);
              default:
                throw new Error(`Unsupported NIfTI datatype: ${datatype}`);
            }
          };

          const rawArray = makeArray();
          const sliced =
            rawArray.length > volumeSize
              ? rawArray.subarray(0, volumeSize)
              : rawArray;

          if (
            rawArray instanceof Float32Array &&
            slope === 1 &&
            intercept === 0
          ) {
            return sliced as Float32Array;
          }

          const floatArray = new Float32Array(sliced.length);
          for (let i = 0; i < sliced.length; i += 1) {
            const value = sliced[i] as number | bigint;
            const numeric =
              typeof value === "bigint" ? Number(value) : value;
            floatArray[i] = numeric * slope + intercept;
          }
          return floatArray;
        };

        const voxelData = toFloat32();
        const dimensions = [
          Number(header.dims[1]),
          Number(header.dims[2]),
          Number(header.dims[3]),
        ];
        const spacing = [
          Number(header.pixDims[1] || 1),
          Number(header.pixDims[2] || 1),
          Number(header.pixDims[3] || 1),
        ];

        const imageData = vtkImageData.newInstance();
        imageData.setDimensions(...dimensions);
        imageData.setSpacing(...spacing);
        const scalars = vtkDataArray.newInstance({
          name: "Scalars",
          numberOfComponents: 1,
          values: voxelData,
        });
        imageData.getPointData().setScalars(scalars);
        const dataRange = scalars.getRange();

        const volumeMapper = vtkVolumeMapper.newInstance();
        volumeMapper.setSampleDistance(0.7);
        volumeMapper.setInputData(imageData);

        const volume = vtkVolume.newInstance();
        volume.setMapper(volumeMapper);

        const ctfun = vtkColorTransferFunction.newInstance();
        const ofun = vtkPiecewiseFunction.newInstance();

        const min = dataRange[0];
        const max = dataRange[1];
        const range = max - min || 1;
        const mid = min + range * 0.5;
        const hi = min + range * 0.85;

        const colorStops =
          VOLUME_COLOR_STOPS[volumeColormap] ?? VOLUME_COLOR_STOPS.radiance;
        colorStops.forEach(([stop, color]) => {
          const value = min + range * stop;
          ctfun.addRGBPoint(value, color[0], color[1], color[2]);
        });

        ofun.addPoint(min, 0.0);
        ofun.addPoint(mid, 0.05);
        ofun.addPoint(hi, 0.25);
        ofun.addPoint(max, 0.9);

        const property = volume.getProperty();
        property.setRGBTransferFunction(0, ctfun);
        property.setScalarOpacity(0, ofun);
        property.setInterpolationTypeToLinear();
        property.setShade(true);
        property.setAmbient(0.2);
        property.setDiffuse(0.7);
        property.setSpecular(0.2);
        property.setScalarOpacityUnitDistance(0, 0.9);

        renderer.addVolume(volume);
        renderer.resetCamera();

        const resize = () => {
          const bounds = container.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          openGLRenderWindow.setSize(
            Math.max(1, Math.floor(bounds.width * dpr)),
            Math.max(1, Math.floor(bounds.height * dpr))
          );
          renderWindow.render();
        };

        const resizeObserver =
          "ResizeObserver" in window
            ? new ResizeObserver(resize)
            : null;
        if (resizeObserver) {
          resizeObserver.observe(container);
        } else {
          window.addEventListener("resize", resize);
        }
        resize();

        viewerCleanupRef.current = () => {
          resizeObserver?.disconnect();
          window.removeEventListener("resize", resize);
          try {
            interactor.unbindEvents();
            interactor.delete();
            openGLRenderWindow.delete();
            renderer.delete();
            renderWindow.delete();
          } catch {
            // no-op
          }
          container.replaceChildren();
        };
      } catch (e: unknown) {
        if (cancelled) return;
        const message =
          e instanceof Error ? e.message : "Failed to initialize 3D viewer.";
        setViewer3dError(message);
      } finally {
        if (!cancelled) {
          setViewer3dLoading(false);
        }
      }
    };

    void initViewer();

    return () => {
      cancelled = true;
      if (viewerCleanupRef.current) {
        viewerCleanupRef.current();
        viewerCleanupRef.current = null;
      }
    };
  }, [viewerMode, uploadPath, viewerChannel, volumeColormap, buildVolumeFileUrl]);

  useEffect(() => {
    if (!jobId) return undefined;

    let active = true;
    let timeoutId: number | undefined;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/results/${jobId}`);
        if (!res.ok) throw new Error(`Results API failed (${res.status})`);
        const data = (await res.json()) as ResultsResponse;
        if (!active) return;
        setJobStatus(data.status);
        setJobResult(data);
        if (data.status === "done") {
          pushNotice(
            "success",
            "Segmentation complete",
            `Job ${data.job_id.slice(0, 8)} is ready.`
          );
          return;
        }
        if (data.status === "error") {
          const message =
            data.error_message || "Segmentation failed. Try another run.";
          setError(message);
          pushNotice(
            "error",
            "Segmentation failed",
            message
          );
          return;
        }
      } catch (e: unknown) {
        if (!active) return;
        const message =
          e instanceof Error ? e.message : "Polling failed. Try again.";
        setError(message);
        setJobStatus("error");
        pushNotice("error", "Polling error", message);
        return;
      }

      timeoutId = window.setTimeout(poll, 1000);
    };

    poll();
    return () => {
      active = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [jobId, pushNotice]);

  const isReady = Boolean(
    uploadResult && selectedModelId && selectedModel?.available
  );
  const isRunning = jobStatus === "queued" || jobStatus === "running";
  const hasOutputs =
    Boolean(jobResult?.outputs?.mask_path) &&
    Boolean(jobResult?.outputs?.report_path);
  const progress =
    jobStatus === "queued"
      ? 25
      : jobStatus === "running"
      ? 68
      : jobStatus === "done"
      ? 100
      : jobStatus === "error"
      ? 100
      : 0;

  const statusLabel = jobStatus
    ? jobStatus.charAt(0).toUpperCase() + jobStatus.slice(1)
    : "Idle";

  const inferFileKind = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".nii") || lower.endsWith(".nii.gz")) return "nifti";
    if (lower.endsWith(".dcm")) return "dicom";
    if (lower.endsWith(".zip")) return "zip";
    return "unknown";
  };

  const selectedFileCount = files.length;
  const selectedFileNames = files.map((item) => item.name);
  const selectionKinds = useMemo(
    () => Array.from(new Set(files.map((item) => inferFileKind(item.name)))),
    [files]
  );
  const selectionLabel = useMemo(() => {
    if (selectedFileCount === 0) return "No files selected";
    if (selectedFileCount === 1) return selectedFileNames[0];
    return `${selectedFileCount} files selected`;
  }, [selectedFileCount, selectedFileNames]);
  const selectionWarning = useMemo(() => {
    if (selectedFileCount <= 1) return "";
    if (selectionKinds.includes("zip")) {
      return "Zip files must be uploaded one at a time.";
    }
    if (selectionKinds.includes("unknown")) {
      return "Some files have unsupported extensions.";
    }
    if (selectionKinds.length > 1) {
      return "Do not mix NIfTI and DICOM files in the same batch.";
    }
    return "";
  }, [selectedFileCount, selectionKinds]);

  const axisSizes = useMemo(() => {
    if (!volumeInfo) return null;
    return {
      sagittal: volumeInfo.shape[0] ?? 0,
      coronal: volumeInfo.shape[1] ?? 0,
      axial: volumeInfo.shape[2] ?? 0,
    };
  }, [volumeInfo]);

  const channelLabels = useMemo(() => {
    const names = uploadPreview?.files?.map((item) => item.name) ?? [];
    return names;
  }, [uploadPreview]);

  const buildSliceUrl = useCallback(
    (axis: AxisKey, index: number) => {
      if (!uploadPath) return "";
      const params = new URLSearchParams({
        path: uploadPath,
        axis,
        index: String(index),
        channel: String(viewerChannel),
        colormap: sliceColormap,
      });
      return `${API_BASE}/api/uploads/slice?${params.toString()}`;
    },
    [uploadPath, viewerChannel, sliceColormap]
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    setFiles(selected);
    setUploadResult(null);
    setUploadPreview(null);
    setVolumeInfo(null);
    setViewerError("");
    setJobId("");
    setJobStatus(null);
    setJobResult(null);
    if (selected.length > 0) {
      const name =
        selected.length === 1 ? selected[0].name : `${selected.length} files`;
      pushNotice("info", "Scan selected", `${name} ready to upload.`);
    }
  };

  const handleModelSelect = (modelId: string) => {
    const model = models.find((item) => item.id === modelId);
    if (model && !model.available) {
      pushNotice(
        "error",
        "Model unavailable",
        "Install local weights before running segmentation."
      );
      return;
    }
    setSelectedModelId(modelId);
    setJobId("");
    setJobStatus(null);
    setJobResult(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select a file first.");
      pushNotice("error", "Upload blocked", "Select a scan file to upload.");
      return;
    }
    if (selectionWarning) {
      setError(selectionWarning);
      pushNotice("error", "Upload blocked", selectionWarning);
      return;
    }

    try {
      setError("");
      setUploading(true);

      const form = new FormData();
      if (files.length === 1) {
        form.append("file", files[0]);
      } else {
        files.forEach((item) => form.append("files", item));
      }

      const endpoint = files.length === 1 ? "/api/uploads" : "/api/uploads/batch";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error(`Upload failed (${res.status})`);

      const data = (await res.json()) as UploadResponse;
      setUploadResult(data);
      setUploadPreview(null);
      pushNotice("success", "Upload complete", "Scan saved successfully.");

      const savedPath = "saved_path" in data ? data.saved_path : "";
      if (savedPath) {
        const previewRes = await fetch(
          `${API_BASE}/api/uploads/preview?path=${encodeURIComponent(savedPath)}`
        );
        if (previewRes.ok) {
          const preview = (await previewRes.json()) as UploadPreview;
          setUploadPreview(preview);
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Upload failed";
      setError(message);
      pushNotice("error", "Upload failed", message);
    } finally {
      setUploading(false);
    }
  };

  const handleRun = async () => {
    if (!uploadResult || !selectedModelId) {
      setError("Select a model and upload a scan to start segmentation.");
      pushNotice(
        "error",
        "Segmentation blocked",
        "Pick a model and upload a scan first."
      );
      return;
    }
    if (!selectedModel?.available) {
      setError("The selected model is not installed locally yet.");
      pushNotice(
        "error",
        "Model unavailable",
        "Add the model weights to run a real job."
      );
      return;
    }

    try {
      setError("");
      setJobResult(null);
      setJobStatus("queued");

      const res = await fetch(`${API_BASE}/api/segment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saved_path: uploadResult.saved_path,
          model_id: selectedModelId,
        }),
      });

      if (!res.ok) throw new Error(`Segmentation failed (${res.status})`);

      const data = (await res.json()) as SegmentResponse;
      setJobId(data.job_id);
      pushNotice(
        "info",
        "Segmentation queued",
        `Job ${data.job_id.slice(0, 8)} has started.`
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Segmentation failed";
      setError(message);
      setJobStatus("error");
      pushNotice("error", "Segmentation failed", message);
    }
  };

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true" />
      <header className="hero">
        <div className="hero-copy">
          <span className="pill">Open source - modular - model agnostic</span>
          <h1 className="hero-title">
            MedAI <span>Platform</span>
          </h1>
          <p className="lead">
            Upload a medical scan, select a segmentation model, and track results
            in real time.
          </p>
          <div className="hero-meta">
            <div className="meta-chip">Workflow: scan to segmentation</div>
            <div className="meta-chip">Jobs: queued, running, done</div>
          </div>
        </div>
        <div className="hero-card">
          <div className="hero-metric">
            <span>Models available</span>
            <strong>
              {availableModels.length} / {models.length}
            </strong>
          </div>
          <div className="hero-metric">
            <span>Selected model</span>
            <strong>{selectedModel?.name || "None"}</strong>
          </div>
          <div className="hero-metric">
            <span>Latest job status</span>
            <strong>{statusLabel}</strong>
          </div>
        </div>
      </header>

      {error && (
        <div className="banner banner-error" role="alert">
          <strong>Action needed:</strong> {error}
        </div>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>1. Choose a segmentation model</h2>
            <p>Pick a model tuned for your scan type.</p>
          </div>
          <span
            className={`status-badge ${
              selectedModelId && selectedModel?.available ? "status-ready" : ""
            }`}
          >
            {selectedModelId
              ? selectedModel?.available
                ? "Selected"
                : "Needs weights"
              : "Select one"}
          </span>
        </div>

        <div className="model-grid">
          {modelsLoading &&
            SKELETONS.map((index) => (
              <div
                className="model-card skeleton"
                key={`model-skeleton-${index}`}
              >
                <div className="skeleton-line wide" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            ))}

          {!modelsLoading && models.length === 0 && (
            <div className="empty-state">No models available.</div>
          )}

          {!modelsLoading &&
            models.map((model) => (
              <button
                type="button"
                key={model.id}
                className={`model-card ${
                  selectedModelId === model.id ? "selected" : ""
                }`}
                onClick={() => handleModelSelect(model.id)}
                disabled={!model.available}
              >
                <div className="model-title">{model.name}</div>
                <div className="model-meta">
                  <span>{model.modality}</span>
                  <span>{model.task.replace(/_/g, " ")}</span>
                </div>
                <div className="model-description">{model.description}</div>
                <div className="model-tag">Model ID: {model.id}</div>
                <div className="model-foot">
                  <span className="model-chip">{model.speed}</span>
                  <span className="model-chip">
                    Inputs: {model.input.map((item) => item.replace(/_/g, " ")).join(", ")}
                  </span>
                </div>
                {!model.available && (
                  <div className="model-warning">Weights not installed</div>
                )}
              </button>
            ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>2. Upload scan</h2>
            <p>Drop your file below to stage the scan.</p>
          </div>
          <span className={`status-badge ${uploadResult ? "status-done" : ""}`}>
            {uploadResult ? "Uploaded" : "Awaiting upload"}
          </span>
        </div>

        <div className={`dropzone ${files.length > 0 ? "has-file" : ""}`}>
          <input
            id="scan-upload"
            className="file-input"
            type="file"
            onChange={handleFileChange}
            multiple
          />
          <label htmlFor="scan-upload">
            <div className="dropzone-main">
              <span className="dropzone-title">
                {selectedFileCount > 0 ? selectionLabel : "Drop scan file here"}
              </span>
              <span className="dropzone-subtitle">
                {selectedFileCount > 0
                  ? selectionWarning || "Ready to upload"
                  : "NIfTI (.nii/.nii.gz), DICOM series, or zipped scans"}
              </span>
            </div>
            <div className="dropzone-chips">
              <span className="chip">Drag and drop</span>
              <span className="chip">Multi-file support</span>
            </div>
          </label>
        </div>

        {selectedFileCount > 1 && (
          <div className="file-list">
            {selectedFileNames.slice(0, 6).map((name) => (
              <span key={name} className="file-pill">
                {name}
              </span>
            ))}
            {selectedFileCount > 6 && (
              <span className="file-pill muted">
                +{selectedFileCount - 6} more
              </span>
            )}
          </div>
        )}

        <div className="upload-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={files.length === 0 || uploading || Boolean(selectionWarning)}
          >
            {uploading ? "Uploading..." : uploadResult ? "Re-upload" : "Upload scan"}
          </button>
          {uploadResult && (
            <div className="upload-meta">
              <span className="status-dot status-done" />
              Saved to <span className="mono">{uploadResult.saved_path}</span>
            </div>
          )}
        </div>

        {uploadPreview && (
          <div className="preview-card">
            <div className="preview-head">
              <div>
                <div className="preview-title">Data preview</div>
                <div className="preview-subtitle">
                  {uploadPreview.kind.replace(/_/g, " ")}
                </div>
              </div>
              {uploadPreview.warnings && uploadPreview.warnings.length > 0 && (
                <span className="status-badge status-queued">
                  {uploadPreview.warnings.length} warning
                  {uploadPreview.warnings.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {uploadPreview.files && uploadPreview.files.length > 0 && (
              <div className="preview-grid">
                {uploadPreview.files.map((item) => (
                  <div className="preview-item" key={item.name}>
                    <div className="preview-name">{item.name}</div>
                    {item.shape && (
                      <div className="preview-meta">
                        Shape: {item.shape.join(" x ")}
                      </div>
                    )}
                    {item.zooms && (
                      <div className="preview-meta">
                        Spacing: {item.zooms.map((value) => value.toFixed(2)).join(", ")}
                      </div>
                    )}
                    {item.dtype && (
                      <div className="preview-meta">Type: {item.dtype}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {uploadPreview.dicom && (
              <div className="preview-grid">
                <div className="preview-item">
                  <div className="preview-name">DICOM series</div>
                  {"slices" in uploadPreview.dicom && (
                    <div className="preview-meta">
                      Slices: {uploadPreview.dicom.slices ?? "n/a"}
                    </div>
                  )}
                  {"rows" in uploadPreview.dicom &&
                    "cols" in uploadPreview.dicom && (
                      <div className="preview-meta">
                        Size: {uploadPreview.dicom.rows} x {uploadPreview.dicom.cols}
                      </div>
                    )}
                  {uploadPreview.dicom.pixel_spacing && (
                    <div className="preview-meta">
                      Spacing: {uploadPreview.dicom.pixel_spacing.join(", ")}
                    </div>
                  )}
                  {uploadPreview.dicom.slice_thickness && (
                    <div className="preview-meta">
                      Slice thickness: {uploadPreview.dicom.slice_thickness}
                    </div>
                  )}
                  {uploadPreview.dicom.modality && (
                    <div className="preview-meta">
                      Modality: {uploadPreview.dicom.modality}
                    </div>
                  )}
                </div>
              </div>
            )}

            {uploadPreview.warnings && uploadPreview.warnings.length > 0 && (
              <div className="preview-warnings">
                {uploadPreview.warnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {uploadResult && (
          <div className="viewer-card">
            <div className="viewer-head">
              <div>
                <div className="viewer-title">Imaging viewer</div>
                <div className="viewer-subtitle">
                  Explore the scan in 2D or full 3D volume.
                </div>
              </div>
              <div className="viewer-actions">
                {enable3DViewer && (
                  <div className="viewer-tabs">
                    <button
                      type="button"
                      className={`viewer-tab ${
                        viewerMode === "3d" ? "active" : ""
                      }`}
                      onClick={() => setViewerMode("3d")}
                    >
                      3D volume
                    </button>
                    <button
                      type="button"
                      className={`viewer-tab ${
                        viewerMode === "2d" ? "active" : ""
                      }`}
                      onClick={() => setViewerMode("2d")}
                    >
                      2D slices
                    </button>
                  </div>
                )}
                {volumeInfo && (
                  <div className="viewer-meta">
                    <span className="meta-chip">
                      Shape: {volumeInfo.shape.join(" x ")}
                    </span>
                    <span className="meta-chip">
                      Channels: {volumeInfo.channels}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {viewerError && (
              <div className="banner banner-error" role="alert">
                {viewerError}
              </div>
            )}

            {viewerMode === "2d" && viewerLoading && (
              <div className="viewer-loading skeleton">
                <div className="skeleton-line wide" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            )}

            {viewerMode === "2d" && !viewerLoading && volumeInfo && axisSizes && (
              <>
                <div className="viewer-controls">
                  <label className="viewer-control">
                    <span>Color map</span>
                    <select
                      value={sliceColormap}
                      onChange={(event) =>
                        setSliceColormap(event.target.value as SliceColorMap)
                      }
                    >
                      {SLICE_COLORMAPS.map((map) => (
                        <option key={map.id} value={map.id}>
                          {map.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="viewer-grid">
                  {(["sagittal", "coronal", "axial"] as AxisKey[]).map((axis) => (
                    <div className="viewer-panel" key={axis}>
                      <div className="viewer-panel-head">
                        <span className="viewer-label">{axis}</span>
                        <span className="viewer-index">
                          {sliceIndex[axis]} / {axisSizes[axis] - 1}
                        </span>
                      </div>
                      <div className="viewer-image">
                        <img
                          src={buildSliceUrl(axis, sliceIndex[axis])}
                          alt={`${axis} slice`}
                          loading="lazy"
                        />
                      </div>
                      <input
                        className="viewer-slider"
                        type="range"
                        min={0}
                        max={Math.max(axisSizes[axis] - 1, 0)}
                        value={sliceIndex[axis]}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setSliceIndex((prev) => ({
                            ...prev,
                            [axis]: value,
                          }));
                        }}
                        disabled={axisSizes[axis] <= 1}
                      />
                    </div>
                  ))}
                </div>

                {volumeInfo.channels > 1 && (
                  <div className="viewer-channel">
                    <div className="viewer-channel-head">
                      <span>Channel</span>
                      <strong>
                        {viewerChannel + 1} / {volumeInfo.channels}
                      </strong>
                    </div>
                    <input
                      className="viewer-slider"
                      type="range"
                      min={0}
                      max={volumeInfo.channels - 1}
                      value={viewerChannel}
                      onChange={(event) =>
                        setViewerChannel(Number(event.target.value))
                      }
                    />
                    {channelLabels.length === volumeInfo.channels && (
                      <div className="viewer-channel-tags">
                        {channelLabels.map((label, index) => (
                          <button
                            key={label}
                            type="button"
                            className={`viewer-tag ${
                              viewerChannel === index ? "active" : ""
                            }`}
                            onClick={() => setViewerChannel(index)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {viewerMode === "3d" && (
              <div className="viewer-3d">
                <div className="viewer-3d-frame">
                  <div className="viewer-3d-canvas" ref={viewerRef} />
                  {viewer3dLoading && (
                    <div className="viewer-3d-loading">
                      Loading volume...
                    </div>
                  )}
                </div>
                {viewer3dError && (
                  <div className="banner banner-error" role="alert">
                    {viewer3dError}
                  </div>
                )}
                <div className="viewer-3d-hint">
                  Drag to rotate, scroll to zoom, right-click to pan.
                </div>
                <div className="viewer-controls">
                  <label className="viewer-control">
                    <span>Color map</span>
                    <select
                      value={volumeColormap}
                      onChange={(event) =>
                        setVolumeColormap(
                          event.target.value as VolumeColorMap
                        )
                      }
                    >
                      {VOLUME_COLORMAPS.map((map) => (
                        <option key={map.id} value={map.id}>
                          {map.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {volumeInfo && volumeInfo.channels > 1 && (
                  <div className="viewer-channel">
                    <div className="viewer-channel-head">
                      <span>Channel</span>
                      <strong>
                        {viewerChannel + 1} / {volumeInfo.channels}
                      </strong>
                    </div>
                    <input
                      className="viewer-slider"
                      type="range"
                      min={0}
                      max={volumeInfo.channels - 1}
                      value={viewerChannel}
                      onChange={(event) =>
                        setViewerChannel(Number(event.target.value))
                      }
                    />
                    {channelLabels.length === volumeInfo.channels && (
                      <div className="viewer-channel-tags">
                        {channelLabels.map((label, index) => (
                          <button
                            key={label}
                            type="button"
                            className={`viewer-tag ${
                              viewerChannel === index ? "active" : ""
                            }`}
                            onClick={() => setViewerChannel(index)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {viewerMode === "2d" && !viewerLoading && !volumeInfo && !viewerError && (
              <p className="muted">Viewer not available for this upload.</p>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>3. Run segmentation</h2>
            <p>Submit the job and monitor progress.</p>
          </div>
          <span
            className={`status-badge ${
              jobStatus ? `status-${jobStatus}` : ""
            } ${isRunning ? "status-pulse" : ""}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="run-actions">
          <button
            type="button"
            className="btn btn-accent"
            onClick={handleRun}
            disabled={!isReady || isRunning}
          >
            {isRunning ? "Processing..." : "Run Segmentation"}
          </button>
          <div className="run-hint">
            {isReady
              ? `Ready with ${selectedModel?.name || "selected model"}.`
              : selectedModelId && !selectedModel?.available
              ? "Install model weights to enable real jobs."
              : "Select a model and upload a scan to enable."}
          </div>
        </div>

        <div className="timeline">
          <div className={`timeline-step ${selectedModelId ? "active" : ""}`}>
            <span>Model selected</span>
          </div>
          <div className={`timeline-step ${uploadResult ? "active" : ""}`}>
            <span>Upload complete</span>
          </div>
          <div className={`timeline-step ${jobStatus ? "active" : ""}`}>
            <span>Job submitted</span>
          </div>
          <div className={`timeline-step ${jobStatus === "done" ? "active" : ""}`}>
            <span>Results ready</span>
          </div>
        </div>

        <div className={`progress-card ${jobId ? "active" : ""}`}>
          <div className="progress-header">
            <div>
              <div className="progress-title">
                {jobId ? `Job ${jobId.slice(0, 8)}` : "No job started"}
              </div>
              <div className="progress-subtitle">
                {jobId
                  ? `Model: ${selectedModel?.name || selectedModelId}`
                  : "Run segmentation to receive a job id."}
              </div>
            </div>
            <span
              className={`status-badge ${
                jobStatus ? `status-${jobStatus}` : ""
              } ${isRunning ? "status-pulse" : ""}`}
            >
              {statusLabel}
            </span>
          </div>
          <div className="progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-meta">
            <span>Queued</span>
            <span>Running</span>
            <span>Done</span>
          </div>
        </div>
      </section>

      <section className="panel results-panel">
        <div className="panel-head">
          <div>
            <h2>4. Results</h2>
            <p>Metrics and outputs appear after processing.</p>
          </div>
          <span className={`status-badge ${jobStatus === "done" ? "status-done" : ""}`}>
            {jobStatus === "done" ? "Complete" : "Pending"}
          </span>
        </div>

        <div className="results-grid">
          <div className="result-card">
            <h3>Metrics</h3>
            {jobStatus === "done" && jobResult ? (
              <>
                <div className="metric">
                  <span className="metric-label">Tumor volume</span>
                  <span className="metric-value">
                    {jobResult.metrics.tumor_volume_cm3.toFixed(1)} cm3
                  </span>
                </div>
                <p className="muted">Placeholder value for MVP.</p>
              </>
            ) : (
              <div className="skeleton-block">
                <div className="skeleton-line wide" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            )}
          </div>

          <div className="result-card">
            <h3>Outputs</h3>
            {jobStatus === "done" && jobResult ? (
              hasOutputs ? (
                <div className="output-list">
                  <div className="output-item">
                    <div>
                      <span className="output-label">Segmentation mask</span>
                      <span className="mono">{jobResult.outputs.mask_path}</span>
                    </div>
                    <a
                      className="btn btn-ghost btn-small"
                      href={buildDownloadUrl(jobResult.outputs.mask_path)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                  </div>
                  <div className="output-item">
                    <div>
                      <span className="output-label">Report</span>
                      <span className="mono">{jobResult.outputs.report_path}</span>
                    </div>
                    <a
                      className="btn btn-ghost btn-small"
                      href={buildDownloadUrl(jobResult.outputs.report_path)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ) : (
                <p className="muted">Outputs not available for this job.</p>
              )
            ) : (
              <div className="skeleton-block">
                <div className="skeleton-line wide" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            )}
          </div>
        </div>

      {jobStatus === "error" && (
          <div className="banner banner-error" role="alert">
            {jobResult?.error_message ||
              "Segmentation failed. Please retry the run."}
          </div>
        )}
      </section>

      <section className="panel history-panel">
        <div className="panel-head">
          <div>
            <h2>5. Recent jobs</h2>
            <p>Completed runs stored in this workspace.</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={loadHistory}
            disabled={historyLoading}
          >
            {historyLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {historyError && (
          <div className="banner banner-error" role="alert">
            {historyError}
          </div>
        )}

        {historyLoading && (
          <div className="history-grid">
            {SKELETONS.map((index) => (
              <div className="history-card skeleton" key={`history-${index}`}>
                <div className="skeleton-line wide" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            ))}
          </div>
        )}

        {!historyLoading && recentJobs.length === 0 && (
          <div className="empty-state">No completed jobs yet.</div>
        )}

        {!historyLoading && recentJobs.length > 0 && (
          <div className="history-grid">
            {recentJobs.map((item) => {
              const itemHasOutputs =
                Boolean(item.outputs?.mask_path) &&
                Boolean(item.outputs?.report_path);
              const volume =
                item.metrics.tumor_volume_cm3 > 0
                  ? `${item.metrics.tumor_volume_cm3.toFixed(1)} cm3`
                  : "n/a";
              return (
                <div className="history-card" key={item.job_id}>
                  <div className="history-head">
                    <div>
                      <div className="history-title">
                        Job {item.job_id.slice(0, 8)}
                      </div>
                      <div className="history-subtitle">
                        Model: {item.model_id || "unknown"}
                      </div>
                    </div>
                    <span className={`status-badge status-${item.status}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="history-meta">
                    <span className="history-label">Input</span>
                    <span className="mono history-input">
                      {item.input_path || "n/a"}
                    </span>
                  </div>
                  <div className="history-metric">
                    <span>Tumor volume</span>
                    <strong>{volume}</strong>
                  </div>
                  <div className="history-actions">
                    {itemHasOutputs ? (
                      <>
                        <a
                          className="btn btn-ghost btn-small"
                          href={buildDownloadUrl(item.outputs.mask_path)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Mask
                        </a>
                        <a
                          className="btn btn-ghost btn-small"
                          href={buildDownloadUrl(item.outputs.report_path)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Report
                        </a>
                      </>
                    ) : (
                      <span className="muted">Outputs pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <footer className="footer">
        <p>For research and decision support only. Not medical diagnosis.</p>
      </footer>

      <div className="toast-stack" aria-live="polite">
        {notices.map((notice) => (
          <div key={notice.id} className={`toast toast-${notice.type}`}>
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
