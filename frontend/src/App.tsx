import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  FormEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import anime from "animejs";
import ChatPanel from './components/ChatPanel';

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

type ReportAnalysisResponse = {
  extracted_values: Record<string, number | string>;
  risk_analysis: {
    risk_level: string;
    abnormalities: Record<string, string>;
    explanations: string[];
    possible_symptoms: string[];
    disclaimer?: string;
  };
  llm_explanation: string;
};

type AuthTokens = {
  access: string;
  refresh: string;
};

type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: string;
  is_staff: boolean;
  is_superuser: boolean;
};

type PasswordResetResponse = {
  detail: string;
  already_verified?: boolean;
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
type Viewer3DMode = "volume" | "mesh";
type MeshTool = "orbit" | "sculpt" | "carve" | "select";
type MeshMaterialPreset =
  | "brain"
  | "bone"
  | "vessel"
  | "skin"
  | "muscle"
  | "glass";
type MeshSource = "scan" | "mask";

type MeshPart = {
  mesh: any;
  geometry: any;
  center: [number, number, number];
  direction: [number, number, number];
};

type MeshSelection = {
  partIndex: number;
  indices: Set<number>;
  overlay: any;
};

type MeshBounds = {
  min: [number, number, number];
  max: [number, number, number];
};

type MeshViewerState = {
  three: any;
  renderer: any;
  scene: any;
  camera: any;
  controls: any;
  meshGroup: any;
  meshParts: MeshPart[];
  sourceGeometry: any;
  material: any;
  overlayMesh?: any;
  overlayMaterial?: any;
  clipPlane: any | null;
  bounds: MeshBounds;
  maxDim: number;
  activePartIndex: number;
  selection?: MeshSelection;
};
type SliceColorMap = "grayscale" | "bone" | "hot" | "cool" | "viridis";
type VolumeColorMap =
  | "radiance"
  | "grayscale"
  | "bone"
  | "hot"
  | "cool"
  | "viridis";
type WorkspaceTool = "brush" | "erase" | "rect" | "measure";
type ClipAxis = "x" | "y" | "z";
type PanelId = "left" | "right";
type ResizeCorner = "nw" | "ne" | "sw" | "se";
type AuthStep =
  | "login"
  | "forgot-request"
  | "forgot-verify"
  | "verify-request"
  | "verify-confirm";

type PanelPosition = {
  x: number;
  y: number;
};
type PanelSize = {
  width: number;
  height: number;
};

type Label = {
  id: string;
  name: string;
  color: string;
};

type NormPoint = {
  x: number;
  y: number;
};

type AnnotationItem = {
  id: string;
  kind: "stroke" | "rect" | "measure";
  labelId: string;
  createdAt: number;
  points?: NormPoint[];
  size?: number;
  tool?: "brush" | "erase";
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x2?: number;
  y2?: number;
  lengthMm?: number;
};

type AnnotationSet = {
  items: AnnotationItem[];
};

type DrawingState = {
  axis: AxisKey;
  item: AnnotationItem;
  start: NormPoint;
};

type Viewer3DState = {
  renderWindow: any;
  renderer: any;
  volumeMapper: any;
  volume: any;
  ctfun: any;
  ofun: any;
  dataRange: [number, number];
  dimensions: number[];
  spacing: number[];
  clipPlane: any | null;
};

const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";
const AUTH_BASE: string =
  (import.meta.env.VITE_AUTH_BASE_URL as string) || "http://localhost:9000";
const AUTH_REQUIRED =
  ((import.meta.env.VITE_AUTH_REQUIRED as string) ?? "false") === "true";
const AUTH_TOKEN_KEY = "medai_auth_token";
const AUTH_REFRESH_KEY = "medai_auth_refresh";

const SKELETONS = Array.from({ length: 3 }, (_, index) => index);
const enable3DViewer =
  ((import.meta.env.VITE_ENABLE_3D_VIEWER as string) ?? "true") === "true";
const MAX_MESH_SCULPT_VERTICES = 200000;
const MAX_MESH_PARTS = 12;
const MESH_MIN_TRIANGLES_PER_PART = 24;
const MESH_MATERIAL_PRESETS: Record<
  MeshMaterialPreset,
  {
    label: string;
    color: number;
    emissive?: number;
    roughness: number;
    metalness: number;
    clearcoat?: number;
    clearcoatRoughness?: number;
    transmission?: number;
    thickness?: number;
    ior?: number;
    sheen?: number;
    sheenColor?: number;
  }
> = {
  brain: {
    label: "Brain tissue",
    color: 0xd9a7a2,
    emissive: 0x3b1f22,
    roughness: 0.45,
    metalness: 0.05,
    clearcoat: 0.25,
    clearcoatRoughness: 0.35,
    transmission: 0.18,
    thickness: 0.6,
    sheen: 0.35,
    sheenColor: 0xf5b5b0,
  },
  bone: {
    label: "Bone",
    color: 0xe9e2d6,
    roughness: 0.7,
    metalness: 0.05,
    clearcoat: 0.08,
    clearcoatRoughness: 0.6,
  },
  vessel: {
    label: "Vessel",
    color: 0xb91c1c,
    emissive: 0x31060b,
    roughness: 0.35,
    metalness: 0.08,
    clearcoat: 0.45,
    clearcoatRoughness: 0.2,
    sheen: 0.45,
    sheenColor: 0xffa3a3,
  },
  skin: {
    label: "Skin",
    color: 0xc98b6a,
    emissive: 0x2a1610,
    roughness: 0.52,
    metalness: 0.05,
    clearcoat: 0.32,
    clearcoatRoughness: 0.25,
    transmission: 0.22,
    thickness: 0.9,
    sheen: 0.3,
    sheenColor: 0xffc9b2,
  },
  muscle: {
    label: "Muscle",
    color: 0x9b2d2d,
    emissive: 0x2a0a0a,
    roughness: 0.48,
    metalness: 0.05,
    clearcoat: 0.2,
    clearcoatRoughness: 0.35,
    sheen: 0.25,
    sheenColor: 0xff9d9d,
  },
  glass: {
    label: "Glass",
    color: 0x6fb9ff,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
    transmission: 0.9,
    thickness: 1.2,
    ior: 1.4,
  },
};
const enableViewerWorkspace =
  ((import.meta.env.VITE_ENABLE_VIEWER_WORKSPACE as string) ?? "true") ===
  "true";
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
const WORKSPACE_TOOLS: Array<{ id: WorkspaceTool; label: string }> = [
  { id: "brush", label: "Brush" },
  { id: "erase", label: "Erase" },
  { id: "rect", label: "Rectangle ROI" },
  { id: "measure", label: "Measure" },
];
const DEFAULT_LABELS: Label[] = [
  { id: "label-1", name: "Tumor", color: "#ff5b6e" },
  { id: "label-2", name: "Organ", color: "#3b82f6" },
  { id: "label-3", name: "Vessel", color: "#22c55e" },
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
  const [authToken, setAuthToken] = useState<string>(() => {
    return localStorage.getItem(AUTH_TOKEN_KEY) ?? "";
  });
  const [, setAuthRefresh] = useState<string>(() => {
    return localStorage.getItem(AUTH_REFRESH_KEY) ?? "";
  });
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>("");
  const [authNotice, setAuthNotice] = useState<string>("");
  const [authUsername, setAuthUsername] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [forgotIdentifier, setForgotIdentifier] = useState<string>("");
  const [forgotOtp, setForgotOtp] = useState<string>("");
  const [forgotPassword, setForgotPassword] = useState<string>("");
  const [forgotConfirm, setForgotConfirm] = useState<string>("");
  const [forgotError, setForgotError] = useState<string>("");
  const [forgotNotice, setForgotNotice] = useState<string>("");
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);
  const [verifyIdentifier, setVerifyIdentifier] = useState<string>("");
  const [verifyOtp, setVerifyOtp] = useState<string>("");
  const [verifyError, setVerifyError] = useState<string>("");
  const [verifyNotice, setVerifyNotice] = useState<string>("");
  const [verifyLoading, setVerifyLoading] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [previewPath, setPreviewPath] = useState<string>("");
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
  const [volumeOpacity, setVolumeOpacity] = useState<number>(0.9);
  const [clipEnabled, setClipEnabled] = useState<boolean>(false);
  const [clipAxis, setClipAxis] = useState<ClipAxis>("z");
  const [clipValue, setClipValue] = useState<number>(0.55);
  const [viewer3dMode, setViewer3dMode] = useState<Viewer3DMode>("volume");
  const [meshTool, setMeshTool] = useState<MeshTool>("orbit");
  const [meshBrushSize, setMeshBrushSize] = useState<number>(12);
  const [meshStrength, setMeshStrength] = useState<number>(0.6);
  const [meshIso, setMeshIso] = useState<number>(0.35);
  const [meshStep, setMeshStep] = useState<number>(2);
  const [meshSource, setMeshSource] = useState<MeshSource>("scan");
  const [meshOverlayEnabled, setMeshOverlayEnabled] = useState<boolean>(true);
  const [meshOverlayOpacity, setMeshOverlayOpacity] = useState<number>(0.55);
  const [meshOverlayIso, setMeshOverlayIso] = useState<number>(0.5);
  const [meshOverlayStep, setMeshOverlayStep] = useState<number>(1);
  const [meshWireframe, setMeshWireframe] = useState<boolean>(false);
  const [meshClipEnabled, setMeshClipEnabled] = useState<boolean>(false);
  const [meshClipAxis, setMeshClipAxis] = useState<ClipAxis>("x");
  const [meshClipValue, setMeshClipValue] = useState<number>(0.5);
  const [meshExplodeEnabled, setMeshExplodeEnabled] =
    useState<boolean>(false);
  const [meshExplodeDistance, setMeshExplodeDistance] =
    useState<number>(0.35);
  const [meshMaterialPreset, setMeshMaterialPreset] =
    useState<MeshMaterialPreset>("brain");
  const [meshGroupCount, setMeshGroupCount] = useState<number>(6);
  const [meshPartCount, setMeshPartCount] = useState<number>(0);
  const [meshActiveGroup, setMeshActiveGroup] = useState<number>(0);
  const [meshIsolateEnabled, setMeshIsolateEnabled] =
    useState<boolean>(false);
  const [meshSelectionRadius, setMeshSelectionRadius] =
    useState<number>(8);
  const [meshSelectionStrength, setMeshSelectionStrength] =
    useState<number>(0.5);
  const [meshSelectionCount, setMeshSelectionCount] =
    useState<number>(0);
  const [meshSelectionPrecision, setMeshSelectionPrecision] =
    useState<boolean>(false);
  const [meshPartOffsets, setMeshPartOffsets] = useState<Record<number, number>>(
    {}
  );
  const [meshLoading, setMeshLoading] = useState<boolean>(false);
  const [meshError, setMeshError] = useState<string>("");
  const [meshVertexCount, setMeshVertexCount] = useState<number>(0);
  const [meshCanSculpt, setMeshCanSculpt] = useState<boolean>(true);
  const [meshRevision, setMeshRevision] = useState<number>(0);
  const [sliceIndex, setSliceIndex] = useState<SliceIndex>({
    sagittal: 0,
    coronal: 0,
    axial: 0,
  });
  const [sliceRequestIndex, setSliceRequestIndex] = useState<SliceIndex>({
    sagittal: 0,
    coronal: 0,
    axial: 0,
  });
  const [viewerChannel, setViewerChannel] = useState<number>(0);
  const [jobId, setJobId] = useState<string>("");
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [jobResult, setJobResult] = useState<ResultsResponse | null>(null);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportResult, setReportResult] =
    useState<ReportAnalysisResponse | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string>("");
  const [reportNotice, setReportNotice] = useState<string>("");
  const [reportValueQuery, setReportValueQuery] = useState<string>("");
  const [reportOnlyAbnormal, setReportOnlyAbnormal] =
    useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [jobHistory, setJobHistory] = useState<JobHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string>("");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [chatPanelOpen, setChatPanelOpen] = useState<boolean>(false);
  const [workspacePath, setWorkspacePath] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("path") ?? "";
  });
  const [workspaceTool, setWorkspaceTool] =
    useState<WorkspaceTool>("brush");
  const [labels, setLabels] = useState<Label[]>(DEFAULT_LABELS);
  const [activeLabelId, setActiveLabelId] = useState<string>(
    DEFAULT_LABELS[0]?.id ?? ""
  );
  const [brushSize, setBrushSize] = useState<number>(12);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.65);
  const [annotationVersion, setAnnotationVersion] = useState<number>(0);
  const [activeAxis, setActiveAxis] = useState<AxisKey>("axial");
  const [panelPositions, setPanelPositions] = useState<{
    left: PanelPosition;
    right: PanelPosition;
  }>({
    left: { x: 16, y: 96 },
    right: { x: 0, y: 96 },
  });
  const [panelSizes, setPanelSizes] = useState<{
    left: PanelSize;
    right: PanelSize;
  }>({
    left: { width: 260, height: 560 },
    right: { width: 320, height: 640 },
  });
  const [showLeftShelf, setShowLeftShelf] = useState<boolean>(true);
  const [showRightShelf, setShowRightShelf] = useState<boolean>(true);
  const [draggingPanel, setDraggingPanel] = useState<PanelId | null>(null);
  const [resizingPanel, setResizingPanel] = useState<PanelId | null>(null);

  const viewerRef = useRef<HTMLDivElement | null>(null);
  const viewerCleanupRef = useRef<(() => void) | null>(null);
  const viewer3dStateRef = useRef<Viewer3DState | null>(null);
  const vtkPlaneRef = useRef<any | null>(null);
  const meshViewerRef = useRef<HTMLDivElement | null>(null);
  const meshCleanupRef = useRef<(() => void) | null>(null);
  const meshStateRef = useRef<MeshViewerState | null>(null);
  const meshSculptingRef = useRef<boolean>(false);
  const meshPendingRef = useRef<{
    point: [number, number, number];
    direction: number;
    partIndex: number;
  } | null>(null);
  const meshRafRef = useRef<number>(0);
  const meshBrushRef = useRef<number>(meshBrushSize);
  const meshStrengthRef = useRef<number>(meshStrength);
  const meshToolRef = useRef<MeshTool>(meshTool);
  const meshExplodeEnabledRef = useRef<boolean>(meshExplodeEnabled);
  const meshExplodeDistanceRef = useRef<number>(meshExplodeDistance);
  const meshSelectionRadiusRef = useRef<number>(meshSelectionRadius);
  const meshSelectionStrengthRef = useRef<number>(meshSelectionStrength);
  const meshSelectionPrecisionRef = useRef<boolean>(meshSelectionPrecision);
  const annotationsRef = useRef<Record<string, AnnotationSet>>({});
  const drawingRef = useRef<DrawingState | null>(null);
  const canvasRefs = useRef<Record<AxisKey, HTMLCanvasElement | null>>({
    sagittal: null,
    coronal: null,
    axial: null,
  });
  const imageRefs = useRef<Record<AxisKey, HTMLImageElement | null>>({
    sagittal: null,
    coronal: null,
    axial: null,
  });
  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);
  const loginScreenRef = useRef<HTMLDivElement | null>(null);
  const slicePrefetchRef = useRef<SliceIndex | null>(null);
  const dragStateRef = useRef<{
    panel: PanelId;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const resizeStateRef = useRef<{
    panel: PanelId;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    startTop: number;
    corner: ResizeCorner;
  } | null>(null);

  const isWorkspace = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return enableViewerWorkspace && params.get("workspace") === "viewer";
  }, [enableViewerWorkspace]);

  useEffect(() => {
    meshBrushRef.current = meshBrushSize;
  }, [meshBrushSize]);

  useEffect(() => {
    meshStrengthRef.current = meshStrength;
  }, [meshStrength]);

  useEffect(() => {
    meshToolRef.current = meshTool;
  }, [meshTool]);

  useEffect(() => {
    meshExplodeEnabledRef.current = meshExplodeEnabled;
  }, [meshExplodeEnabled]);

  useEffect(() => {
    meshExplodeDistanceRef.current = meshExplodeDistance;
  }, [meshExplodeDistance]);

  useEffect(() => {
    meshSelectionRadiusRef.current = meshSelectionRadius;
  }, [meshSelectionRadius]);

  useEffect(() => {
    meshSelectionStrengthRef.current = meshSelectionStrength;
  }, [meshSelectionStrength]);

  useEffect(() => {
    meshSelectionPrecisionRef.current = meshSelectionPrecision;
  }, [meshSelectionPrecision]);

  useEffect(() => {
    if (isWorkspace) return;
    if (viewer3dMode !== "volume") {
      setViewer3dMode("volume");
    }
  }, [isWorkspace, viewer3dMode]);

  useEffect(() => {
    if (!isWorkspace) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevHeight = document.body.style.height;
    document.body.style.overflow = "hidden";
    document.body.style.height = "100vh";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.height = prevHeight;
    };
  }, [isWorkspace]);

  useEffect(() => {
    if (!isWorkspace) return undefined;
    const updatePositions = () => {
      const rightWidth = panelSizes.right.width;
      const maxX = Math.max(16, window.innerWidth - rightWidth - 16);
      setPanelPositions((prev) => ({
        left: prev.left,
        right: {
          x: prev.right.x === 0 ? maxX : Math.min(prev.right.x, maxX),
          y: prev.right.y || 96,
        },
      }));
    };
    updatePositions();
    window.addEventListener("resize", updatePositions);
    return () => {
      window.removeEventListener("resize", updatePositions);
    };
  }, [isWorkspace, panelSizes.right.width]);

  useEffect(() => {
    if (!isWorkspace) return;
    const clamp = (pos: PanelPosition, size: PanelSize) => {
      const minX = 8;
      const minY = 56;
      const maxX = Math.max(minX, window.innerWidth - size.width - 8);
      const maxY = Math.max(minY, window.innerHeight - size.height - 8);
      return {
        x: Math.min(maxX, Math.max(minX, pos.x)),
        y: Math.min(maxY, Math.max(minY, pos.y)),
      };
    };
    setPanelPositions((prev) => ({
      left: clamp(prev.left, panelSizes.left),
      right: clamp(prev.right, panelSizes.right),
    }));
  }, [isWorkspace, panelSizes]);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) || null,
    [models, selectedModelId]
  );
  const availableModels = useMemo(
    () => models.filter((model) => model.available),
    [models]
  );
  const recentJobs = useMemo(() => jobHistory.slice(0, 6), [jobHistory]);
  const reportValues = useMemo(
    () => Object.entries(reportResult?.extracted_values ?? {}),
    [reportResult]
  );
  const reportAbnormalities = useMemo(
    () => Object.entries(reportResult?.risk_analysis?.abnormalities ?? {}),
    [reportResult]
  );
  const reportAbnormalityMap = useMemo(
    () => new Map(reportAbnormalities),
    [reportAbnormalities]
  );
  const reportFilteredValues = useMemo(() => {
    const query = reportValueQuery.trim().toLowerCase();
    return reportValues.filter(([key]) => {
      if (reportOnlyAbnormal && !reportAbnormalityMap.has(key)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return key.toLowerCase().includes(query);
    });
  }, [reportValues, reportValueQuery, reportOnlyAbnormal, reportAbnormalityMap]);
  const reportStats = useMemo(() => {
    const valueCount = reportValues.length;
    const abnormalCount = reportAbnormalities.length;
    const symptomCount =
      reportResult?.risk_analysis?.possible_symptoms?.length ?? 0;
    return { valueCount, abnormalCount, symptomCount };
  }, [reportValues, reportAbnormalities, reportResult]);
  const reportRiskLevel = reportResult?.risk_analysis?.risk_level ?? "";
  const reportRiskClass = reportRiskLevel
    ? `report-risk-${reportRiskLevel}`
    : "";
  const uploadPath = workspacePath || uploadResult?.saved_path || "";
  const isAuthenticated = Boolean(authToken && authUser);
  const authDisplayName = authUser?.email || authUser?.username || "User";
  const authRoleLabel = authUser?.role || "";
  const showLogin = AUTH_REQUIRED && authChecked && !authUser;
  const showAuthGate = AUTH_REQUIRED && !authChecked;
  const isAuthFlow = authStep !== "login";
  const isForgotFlow =
    authStep === "forgot-request" || authStep === "forgot-verify";
  const isVerifyFlow =
    authStep === "verify-request" || authStep === "verify-confirm";
  const meshSculptEnabled = meshCanSculpt && !meshExplodeEnabled;
  const activePartOffset = meshPartOffsets[meshActiveGroup] ?? 0;
  const hasPartOffsets = Object.keys(meshPartOffsets).length > 0;
  const meshHint = useMemo(() => {
    if (meshTool === "orbit") {
      return "Orbit tool: drag to rotate, scroll to zoom, right-click to pan.";
    }
    if (meshTool === "select") {
      return "Select tool: click to pick voxels. Hold Ctrl or Shift + drag to orbit.";
    }
    if (meshExplodeEnabled) {
      return "Explode view: separate anatomy groups. Hold Ctrl or Shift + drag to orbit.";
    }
    if (meshTool === "sculpt") {
      return "Sculpt tool: drag to add volume. Hold Ctrl or Shift + drag to orbit.";
    }
    return "Carve tool: drag to remove volume. Hold Ctrl or Shift + drag to orbit.";
  }, [meshTool, meshExplodeEnabled]);

  useEffect(() => {
    if (!showLogin) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevHeight = document.body.style.height;
    document.body.style.overflow = "hidden";
    document.body.style.height = "100vh";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.height = prevHeight;
    };
  }, [showLogin]);

  const resetAuthFlow = useCallback(() => {
    setForgotIdentifier("");
    setForgotOtp("");
    setForgotPassword("");
    setForgotConfirm("");
    setForgotError("");
    setForgotNotice("");
    setForgotLoading(false);
    setVerifyIdentifier("");
    setVerifyOtp("");
    setVerifyError("");
    setVerifyNotice("");
    setVerifyLoading(false);
    setAuthStep("login");
  }, []);

  const clearAuthSession = useCallback((): void => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_REFRESH_KEY);
    setAuthToken("");
    setAuthRefresh("");
    setAuthUser(null);
  }, []);

  const apiFetch = useCallback(
    (url: string, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers || {});
      if (authToken) {
        headers.set("Authorization", `Bearer ${authToken}`);
      }
      return fetch(url, { ...init, headers }).then((res) => {
        if (res.status === 401 && authToken) {
          clearAuthSession();
          setAuthError("Session expired. Please sign in again.");
        }
        return res;
      });
    },
    [authToken, clearAuthSession]
  );

  const buildDownloadUrl = useCallback(
    (path: string): string => {
      const params = new URLSearchParams({ path });
      if (authToken) {
        params.set("token", authToken);
      }
      return `${API_BASE}/api/download?${params.toString()}`;
    },
    [authToken]
  );

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
        const res = await apiFetch(`${API_BASE}/api/models`);
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

    if (AUTH_REQUIRED && !isAuthenticated) {
      setModels([]);
      setModelsLoading(false);
      return () => {
        active = false;
      };
    }

    loadModels();
    return () => {
      active = false;
    };
  }, [pushNotice, apiFetch, isAuthenticated]);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryError("");
      setHistoryLoading(true);
      const res = await apiFetch(`${API_BASE}/api/jobs`);
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
  }, [apiFetch]);

  useEffect(() => {
    if (AUTH_REQUIRED && !isAuthenticated) return;
    loadHistory();
  }, [loadHistory, isAuthenticated]);

  useEffect(() => {
    if (AUTH_REQUIRED && !isAuthenticated) return;
    if (jobStatus === "done") {
      loadHistory();
    }
  }, [jobStatus, loadHistory, isAuthenticated]);

  const fetchVolumeInfo = useCallback(async (path: string) => {
    try {
      setViewerError("");
      setViewerLoading(true);
      const res = await apiFetch(
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
  }, [apiFetch]);

  useEffect(() => {
    if (!uploadPath) {
      setVolumeInfo(null);
      setViewerError("");
      return;
    }
    if (AUTH_REQUIRED && !isAuthenticated) return;
    fetchVolumeInfo(uploadPath);
  }, [fetchVolumeInfo, uploadPath, isAuthenticated]);

  useEffect(() => {
    if (!uploadPath) {
      setPreviewPath("");
      return;
    }
    if (AUTH_REQUIRED && !isAuthenticated) return;
    if (previewPath === uploadPath) return;
    const fetchPreview = async () => {
      try {
        const previewRes = await apiFetch(
          `${API_BASE}/api/uploads/preview?path=${encodeURIComponent(uploadPath)}`
        );
        if (!previewRes.ok) return;
        const preview = (await previewRes.json()) as UploadPreview;
        setUploadPreview(preview);
        setPreviewPath(uploadPath);
      } catch {
        // no-op
      }
    };
    void fetchPreview();
  }, [uploadPath, previewPath, apiFetch, isAuthenticated]);

  useEffect(() => {
    if (!volumeInfo || volumeInfo.shape.length < 3) return;
    const midpoints = {
      sagittal: Math.floor(volumeInfo.shape[0] / 2),
      coronal: Math.floor(volumeInfo.shape[1] / 2),
      axial: Math.floor(volumeInfo.shape[2] / 2),
    };
    setSliceIndex(midpoints);
    setSliceRequestIndex(midpoints);
    setViewerChannel(0);
  }, [volumeInfo]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSliceRequestIndex(sliceIndex);
    }, 90);
    return () => window.clearTimeout(handle);
  }, [sliceIndex]);

  const buildVolumeFileUrl = useCallback(() => {
    if (!uploadPath) return "";
    const params = new URLSearchParams({
      path: uploadPath,
      channel: String(viewerChannel),
      t: String(Date.now()),
    });
    if (authToken) {
      params.set("token", authToken);
    }
    return `${API_BASE}/api/uploads/volume-file?${params.toString()}`;
  }, [uploadPath, viewerChannel, authToken]);

  const buildMeshUrl = useCallback(
    (
      pathOverride?: string,
      isoOverride?: number,
      stepOverride?: number,
      channelOverride?: number
    ) => {
      const path = pathOverride ?? uploadPath;
      if (!path) return "";
      const iso = isoOverride ?? meshIso;
      const step = stepOverride ?? meshStep;
      const channel = channelOverride ?? viewerChannel;
      const params = new URLSearchParams({
        path,
        channel: String(channel),
        iso: String(iso),
        step: String(step),
        rev: String(meshRevision),
        t: String(Date.now()),
      });
      if (authToken) {
        params.set("token", authToken);
      }
      return `${API_BASE}/api/uploads/mesh?${params.toString()}`;
    },
    [uploadPath, viewerChannel, meshIso, meshStep, meshRevision, authToken]
  );

  const fallbackMaskPath = useMemo(() => {
    if (!jobHistory.length) return "";
    const candidates = jobHistory.filter(
      (item) => item.status === "done" && Boolean(item.outputs?.mask_path)
    );
    if (!candidates.length) return "";
    if (uploadPath) {
      const match = candidates.find((item) => item.input_path === uploadPath);
      if (match) return match.outputs.mask_path;
    }
    return candidates[0]?.outputs?.mask_path ?? "";
  }, [jobHistory, uploadPath]);

  const meshMaskPath =
    jobResult?.outputs?.mask_path && jobResult.outputs.mask_path.length > 0
      ? jobResult.outputs.mask_path
      : fallbackMaskPath;
  const meshMaskAvailable = Boolean(meshMaskPath);
  const meshPrimaryPath = useMemo(
    () => (meshSource === "mask" ? meshMaskPath : uploadPath),
    [meshSource, meshMaskPath, uploadPath]
  );
  const meshOverlayPath = useMemo(
    () => (meshSource === "scan" && meshOverlayEnabled ? meshMaskPath : ""),
    [meshSource, meshOverlayEnabled, meshMaskPath]
  );

  const requestMeshRebuild = useCallback(() => {
    if (!uploadPath) return;
    setMeshRevision((value) => value + 1);
  }, [uploadPath]);

  const clearMeshSelection = useCallback(() => {
    const state = meshStateRef.current;
    if (!state?.selection) {
      setMeshSelectionCount(0);
      return;
    }
    const overlay = state.selection.overlay;
    if (overlay?.parent) {
      overlay.parent.remove(overlay);
    }
    if (overlay?.geometry) {
      overlay.geometry.dispose();
    }
    if (overlay?.material) {
      overlay.material.dispose();
    }
    state.selection = undefined;
    setMeshSelectionCount(0);
  }, []);

  const rebuildMeshSelectionOverlay = useCallback(
    (partIndex: number, indices: Set<number>) => {
      const state = meshStateRef.current;
      if (!state) return;
      if (state.selection?.overlay) {
        const oldOverlay = state.selection.overlay;
        if (oldOverlay.parent) {
          oldOverlay.parent.remove(oldOverlay);
        }
        oldOverlay.geometry?.dispose?.();
        oldOverlay.material?.dispose?.();
        state.selection = undefined;
      }
      const part = state.meshParts[partIndex];
      if (!part) return;
      const { three: THREE } = state;
      const positions = part.geometry.attributes.position
        .array as Float32Array;
      const overlayPositions = new Float32Array(indices.size * 3);
      let cursor = 0;
      indices.forEach((index) => {
        const offset = index * 3;
        overlayPositions[cursor] = positions[offset];
        overlayPositions[cursor + 1] = positions[offset + 1];
        overlayPositions[cursor + 2] = positions[offset + 2];
        cursor += 3;
      });
      const overlayGeometry = new THREE.BufferGeometry();
      overlayGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(overlayPositions, 3)
      );
      const overlayMaterial = new THREE.PointsMaterial({
        color: new THREE.Color(0x38bdf8),
        size: Math.max(state.maxDim * 0.012, 0.05),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      });
      const overlay = new THREE.Points(overlayGeometry, overlayMaterial);
      overlay.renderOrder = 3;
      overlay.frustumCulled = false;
      part.mesh.add(overlay);
      state.selection = { partIndex, indices, overlay };
      state.activePartIndex = partIndex;
      setMeshActiveGroup(partIndex);
      setMeshSelectionCount(indices.size);
    },
    []
  );

  const nudgeMeshSelection = useCallback((direction: number) => {
    const state = meshStateRef.current;
    if (!state?.selection) return;
    const part = state.meshParts[state.selection.partIndex];
    if (!part) return;
    const positions = part.geometry.attributes.position;
    const normals = part.geometry.attributes.normal;
    const posArray = positions.array as Float32Array;
    const normArray = normals.array as Float32Array;
    const step =
      (meshSelectionStrengthRef.current * state.maxDim * 0.01) * direction;
    state.selection.indices.forEach((index) => {
      const offset = index * 3;
      posArray[offset] += normArray[offset] * step;
      posArray[offset + 1] += normArray[offset + 1] * step;
      posArray[offset + 2] += normArray[offset + 2] * step;
    });
    positions.needsUpdate = true;
    part.geometry.computeVertexNormals();
    normals.needsUpdate = true;

    const overlay = state.selection.overlay;
    if (overlay?.geometry?.attributes?.position) {
      const overlayArray = overlay.geometry.attributes.position
        .array as Float32Array;
      let cursor = 0;
      state.selection.indices.forEach((index) => {
        const offset = index * 3;
        overlayArray[cursor] = posArray[offset];
        overlayArray[cursor + 1] = posArray[offset + 1];
        overlayArray[cursor + 2] = posArray[offset + 2];
        cursor += 3;
      });
      overlay.geometry.attributes.position.needsUpdate = true;
    } else {
      rebuildMeshSelectionOverlay(state.selection.partIndex, state.selection.indices);
    }
  }, [rebuildMeshSelectionOverlay]);

  const stepMeshActiveGroup = useCallback(
    (direction: number) => {
      setMeshActiveGroup((value) => {
        if (meshPartCount <= 1) return 0;
        const next = value + direction;
        if (next < 0) return meshPartCount - 1;
        if (next >= meshPartCount) return 0;
        return next;
      });
    },
    [meshPartCount]
  );

  const updateActivePartOffset = useCallback(
    (value: number) => {
      const clamped = Math.max(-1, Math.min(1, value));
      setMeshPartOffsets((prev) => {
        const next = { ...prev, [meshActiveGroup]: clamped };
        if (Math.abs(clamped) < 0.001) {
          delete next[meshActiveGroup];
        }
        return next;
      });
    },
    [meshActiveGroup]
  );

  const resetPartOffsets = useCallback(() => {
    setMeshPartOffsets({});
  }, []);

  useEffect(() => {
    if (AUTH_REQUIRED && !isAuthenticated) return;
    if (!enable3DViewer || viewerMode !== "3d" || viewer3dMode !== "volume") {
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
        const vtkRenderWindowModule = await import(
          "vtk.js/Sources/Rendering/Core/RenderWindow"
        );
        const vtkRendererModule = await import(
          "vtk.js/Sources/Rendering/Core/Renderer"
        );
        // @ts-expect-error vtk.js OpenGL bindings ship without types
        await import("vtk.js/Sources/Rendering/OpenGL/Renderer");
        // @ts-expect-error vtk.js OpenGL bindings ship without types
        await import("vtk.js/Sources/Rendering/OpenGL/Camera");
        const vtkOpenGLRenderWindowModule = await import(
          "vtk.js/Sources/Rendering/OpenGL/RenderWindow"
        );
        // @ts-expect-error vtk.js OpenGL bindings ship without types
        await import("vtk.js/Sources/Rendering/OpenGL/Volume");
        // @ts-expect-error vtk.js OpenGL bindings ship without types
        await import("vtk.js/Sources/Rendering/OpenGL/VolumeMapper");
        const vtkRenderWindowInteractorModule = await import(
          "vtk.js/Sources/Rendering/Core/RenderWindowInteractor"
        );
        const vtkInteractorStyleTrackballCameraModule = await import(
          "vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera"
        );
        const vtkVolumeModule = await import(
          "vtk.js/Sources/Rendering/Core/Volume"
        );
        const vtkVolumeMapperModule = await import(
          "vtk.js/Sources/Rendering/Core/VolumeMapper"
        );
        const vtkColorTransferFunctionModule = await import(
          "vtk.js/Sources/Rendering/Core/ColorTransferFunction"
        );
        const vtkPiecewiseFunctionModule = await import(
          "vtk.js/Sources/Common/DataModel/PiecewiseFunction"
        );
        const vtkImageDataModule = await import(
          "vtk.js/Sources/Common/DataModel/ImageData"
        );
        const vtkDataArrayModule = await import(
          "vtk.js/Sources/Common/Core/DataArray"
        );
        const vtkPlaneModule = await import(
          "vtk.js/Sources/Common/DataModel/Plane"
        );
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
        const vtkPlane = vtkPlaneModule.default;
        const nifti = niftiModule;

        vtkPlaneRef.current = vtkPlane;

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

        const response = await apiFetch(buildVolumeFileUrl());
        if (!response.ok) {
          throw new Error(`Volume download failed (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const toArrayBuffer = (data: ArrayBufferLike): ArrayBuffer => {
          if (data instanceof ArrayBuffer) return data;
          return new Uint8Array(data).slice().buffer;
        };
        let buffer: ArrayBuffer = arrayBuffer;
        if (nifti.isCompressed(buffer)) {
          buffer = toArrayBuffer(nifti.decompress(buffer) as ArrayBufferLike);
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
        const dimensions: [number, number, number] = [
          Number(header.dims[1]),
          Number(header.dims[2]),
          Number(header.dims[3]),
        ];
        const spacing: [number, number, number] = [
          Number(header.pixDims[1] || 1),
          Number(header.pixDims[2] || 1),
          Number(header.pixDims[3] || 1),
        ];

        const imageData = vtkImageData.newInstance();
        imageData.setDimensions(dimensions);
        imageData.setSpacing(spacing);
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
        const opacityScale = Math.max(0, Math.min(volumeOpacity, 1));
        const mid = min + range * 0.5;
        const hi = min + range * 0.85;

        const colorStops =
          VOLUME_COLOR_STOPS[volumeColormap] ?? VOLUME_COLOR_STOPS.radiance;
        colorStops.forEach(([stop, color]) => {
          const value = min + range * stop;
          ctfun.addRGBPoint(value, color[0], color[1], color[2]);
        });

        ofun.addPoint(min, 0.0);
        ofun.addPoint(mid, 0.05 * opacityScale);
        ofun.addPoint(hi, 0.25 * opacityScale);
        ofun.addPoint(max, 0.9 * opacityScale);

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

        viewer3dStateRef.current = {
          renderWindow,
          renderer,
          volumeMapper,
          volume,
          ctfun,
          ofun,
          dataRange: [min, max],
          dimensions,
          spacing,
          clipPlane: null,
        };

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
          viewer3dStateRef.current = null;
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
  }, [
    viewerMode,
    viewer3dMode,
    uploadPath,
    viewerChannel,
    buildVolumeFileUrl,
    apiFetch,
    isAuthenticated,
  ]);

  useEffect(() => {
    if (viewerMode !== "3d" || viewer3dMode !== "mesh") return;
    if (!meshPrimaryPath) return;
    setMeshError("");
    setMeshRevision((value) => value + 1);
  }, [viewerMode, viewer3dMode, meshPrimaryPath]);

  useEffect(() => {
    if (AUTH_REQUIRED && !isAuthenticated) return;
    if (!enable3DViewer || viewerMode !== "3d" || viewer3dMode !== "mesh") {
      if (meshCleanupRef.current) {
        meshCleanupRef.current();
        meshCleanupRef.current = null;
      }
      setMeshLoading(false);
      setMeshError("");
      return;
    }
    if (!meshPrimaryPath || !meshViewerRef.current) {
      if (meshCleanupRef.current) {
        meshCleanupRef.current();
        meshCleanupRef.current = null;
      }
      setMeshLoading(false);
      if (meshSource === "mask" && !meshMaskAvailable) {
        setMeshError("Segmentation mask not available yet.");
      }
      return;
    }

    let cancelled = false;
    setMeshError("");
    setMeshLoading(true);

    const container = meshViewerRef.current;
    container.replaceChildren();

    const initMeshViewer = async () => {
      try {
        const THREE = await import("three");
        const controlsModule = await import(
          "three/examples/jsm/controls/OrbitControls"
        );
        const loaderModule = await import(
          "three/examples/jsm/loaders/PLYLoader"
        );

        if (cancelled) return;

        const { OrbitControls } = controlsModule as {
          OrbitControls: new (...args: any[]) => any;
        };
        const { PLYLoader } = loaderModule as {
          PLYLoader: new () => {
            parse: (data: ArrayBuffer) => any;
          };
        };

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setClearColor(0x0b0b0b, 1);
        renderer.localClippingEnabled = true;
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0b0b0b);

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
        camera.position.set(0, 0, 8);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enabled = meshToolRef.current === "orbit";

        const ambient = new THREE.AmbientLight(0xffffff, 0.45);
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
        keyLight.position.set(4, 6, 8);
        const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.4);
        fillLight.position.set(-6, -2, 4);
        const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
        rimLight.position.set(-8, 4, -6);
        scene.add(ambient, keyLight, fillLight, rimLight);

        const primaryChannel = meshSource === "mask" ? 0 : viewerChannel;
        const response = await apiFetch(
          buildMeshUrl(meshPrimaryPath, meshIso, meshStep, primaryChannel)
        );
        if (!response.ok) {
          throw new Error(`Mesh download failed (${response.status})`);
        }
        const buffer = await response.arrayBuffer();
        const loader = new PLYLoader();
        const rawGeometry = loader.parse(buffer);
        const sourceGeometry = rawGeometry.index
          ? rawGeometry.toNonIndexed()
          : rawGeometry;
        sourceGeometry.computeVertexNormals();
        sourceGeometry.computeBoundingBox();
        const rawBounds = sourceGeometry.boundingBox
          ? sourceGeometry.boundingBox.clone()
          : new THREE.Box3().setFromBufferAttribute(
              sourceGeometry.attributes.position
            );
        const mainCenter = rawBounds.getCenter(new THREE.Vector3());
        sourceGeometry.translate(-mainCenter.x, -mainCenter.y, -mainCenter.z);
        sourceGeometry.computeBoundingBox();

        const bounds = sourceGeometry.boundingBox
          ? sourceGeometry.boundingBox.clone()
          : new THREE.Box3().setFromBufferAttribute(
              sourceGeometry.attributes.position
            );
        const center = bounds.getCenter(new THREE.Vector3());
        const size = new THREE.Vector3();
        bounds.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;

        const materialPreset = MESH_MATERIAL_PRESETS[meshMaterialPreset];
        const material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(materialPreset.color),
          roughness: materialPreset.roughness,
          metalness: materialPreset.metalness,
          clearcoat: materialPreset.clearcoat ?? 0,
          clearcoatRoughness: materialPreset.clearcoatRoughness ?? 0,
          transmission: materialPreset.transmission ?? 0,
          thickness: materialPreset.thickness ?? 0,
          ior: materialPreset.ior ?? 1.5,
          sheen: materialPreset.sheen ?? 0,
          sheenColor: new THREE.Color(
            materialPreset.sheenColor ?? 0x000000
          ),
          emissive: new THREE.Color(materialPreset.emissive ?? 0x000000),
          side: THREE.DoubleSide,
        });

        const meshGroup = new THREE.Group();
        const positions = sourceGeometry.attributes.position
          .array as Float32Array;
        const totalVertices = sourceGeometry.attributes.position.count;
        const triangleCount = Math.max(1, Math.floor(totalVertices / 3));
        const requestedParts = Math.min(
          MAX_MESH_PARTS,
          Math.max(1, meshGroupCount)
        );
        const maxPartsByTriangles = Math.max(
          1,
          Math.floor(triangleCount / MESH_MIN_TRIANGLES_PER_PART)
        );
        const sampleStride = Math.max(1, Math.floor(totalVertices / 2200));
        const samples: number[] = [];
        for (let i = 0; i < totalVertices; i += sampleStride) {
          const offset = i * 3;
          samples.push(
            positions[offset],
            positions[offset + 1],
            positions[offset + 2]
          );
        }
        const sampleCount = Math.max(1, Math.floor(samples.length / 3));
        let partCount = Math.min(requestedParts, maxPartsByTriangles, sampleCount);
        if (!Number.isFinite(partCount) || partCount < 1) {
          partCount = 1;
        }

        const meshParts: MeshPart[] = [];
        if (partCount <= 1) {
          const partGeometry = sourceGeometry.clone();
          partGeometry.computeVertexNormals();
          partGeometry.computeBoundingBox();
          const partMesh = new THREE.Mesh(partGeometry, material);
          meshGroup.add(partMesh);
          const partCenterVec = new THREE.Vector3();
          partGeometry.boundingBox?.getCenter(partCenterVec);
          const directionVec = partCenterVec.clone().sub(center);
          if (directionVec.length() < 0.0001) {
            directionVec.set(0, 0, 1);
          } else {
            directionVec.normalize();
          }
          meshParts.push({
            mesh: partMesh,
            geometry: partGeometry,
            center: [partCenterVec.x, partCenterVec.y, partCenterVec.z],
            direction: [directionVec.x, directionVec.y, directionVec.z],
          });
        } else {
          const centers: Array<[number, number, number]> = Array.from(
            { length: partCount },
            (_, index) => {
              const sampleIndex = Math.min(
                sampleCount - 1,
                Math.floor((index / partCount) * sampleCount)
              );
              const base = sampleIndex * 3;
              return [samples[base], samples[base + 1], samples[base + 2]];
            }
          );

          for (let iter = 0; iter < 6; iter += 1) {
            const sums: Array<[number, number, number, number]> = Array.from(
              { length: partCount },
              () => [0, 0, 0, 0]
            );
            for (let s = 0; s < sampleCount; s += 1) {
              const base = s * 3;
              const x = samples[base];
              const y = samples[base + 1];
              const z = samples[base + 2];
              let best = 0;
              let bestDist = Number.POSITIVE_INFINITY;
              for (let k = 0; k < partCount; k += 1) {
                const dx = x - centers[k][0];
                const dy = y - centers[k][1];
                const dz = z - centers[k][2];
                const dist = dx * dx + dy * dy + dz * dz;
                if (dist < bestDist) {
                  bestDist = dist;
                  best = k;
                }
              }
              const bucket = sums[best];
              bucket[0] += x;
              bucket[1] += y;
              bucket[2] += z;
              bucket[3] += 1;
            }
            for (let k = 0; k < partCount; k += 1) {
              const bucket = sums[k];
              if (bucket[3] > 0) {
                centers[k] = [
                  bucket[0] / bucket[3],
                  bucket[1] / bucket[3],
                  bucket[2] / bucket[3],
                ];
              }
            }
          }

          const groupBuckets: number[][] = Array.from(
            { length: partCount },
            () => []
          );
          for (let i = 0; i < positions.length; i += 9) {
            const x1 = positions[i];
            const y1 = positions[i + 1];
            const z1 = positions[i + 2];
            const x2 = positions[i + 3];
            const y2 = positions[i + 4];
            const z2 = positions[i + 5];
            const x3 = positions[i + 6];
            const y3 = positions[i + 7];
            const z3 = positions[i + 8];
            const cx = (x1 + x2 + x3) / 3;
            const cy = (y1 + y2 + y3) / 3;
            const cz = (z1 + z2 + z3) / 3;
            let best = 0;
            let bestDist = Number.POSITIVE_INFINITY;
            for (let k = 0; k < partCount; k += 1) {
              const dx = cx - centers[k][0];
              const dy = cy - centers[k][1];
              const dz = cz - centers[k][2];
              const dist = dx * dx + dy * dy + dz * dz;
              if (dist < bestDist) {
                bestDist = dist;
                best = k;
              }
            }
            const bucket = groupBuckets[best];
            bucket.push(
              x1,
              y1,
              z1,
              x2,
              y2,
              z2,
              x3,
              y3,
              z3
            );
          }

          groupBuckets.forEach((bucket) => {
            if (bucket.length < 9) return;
            const partGeometry = new THREE.BufferGeometry();
            partGeometry.setAttribute(
              "position",
              new THREE.BufferAttribute(new Float32Array(bucket), 3)
            );
            partGeometry.computeVertexNormals();
            partGeometry.computeBoundingBox();
            const partMesh = new THREE.Mesh(partGeometry, material);
            meshGroup.add(partMesh);
            const partCenterVec = new THREE.Vector3();
            partGeometry.boundingBox?.getCenter(partCenterVec);
            const directionVec = partCenterVec.clone().sub(center);
            if (directionVec.length() < 0.0001) {
              directionVec.set(0, 0, 1);
            } else {
              directionVec.normalize();
            }
            meshParts.push({
              mesh: partMesh,
              geometry: partGeometry,
              center: [partCenterVec.x, partCenterVec.y, partCenterVec.z],
              direction: [directionVec.x, directionVec.y, directionVec.z],
            });
          });

          if (!meshParts.length) {
            const fallbackGeometry = sourceGeometry.clone();
            fallbackGeometry.computeVertexNormals();
            fallbackGeometry.computeBoundingBox();
            const fallbackMesh = new THREE.Mesh(fallbackGeometry, material);
            meshGroup.add(fallbackMesh);
            const fallbackCenter = new THREE.Vector3();
            fallbackGeometry.boundingBox?.getCenter(fallbackCenter);
            const directionVec = fallbackCenter.clone().sub(center);
            if (directionVec.length() < 0.0001) {
              directionVec.set(0, 0, 1);
            } else {
              directionVec.normalize();
            }
            meshParts.push({
              mesh: fallbackMesh,
              geometry: fallbackGeometry,
              center: [fallbackCenter.x, fallbackCenter.y, fallbackCenter.z],
              direction: [directionVec.x, directionVec.y, directionVec.z],
            });
          }
        }

        scene.add(meshGroup);
        let overlayMesh: any | null = null;
        let overlayMaterial: any | null = null;
        if (meshOverlayPath) {
          try {
            const overlayResponse = await apiFetch(
              buildMeshUrl(meshOverlayPath, meshOverlayIso, meshOverlayStep, 0)
            );
            if (overlayResponse.ok) {
              const overlayBuffer = await overlayResponse.arrayBuffer();
              const overlayRaw = loader.parse(overlayBuffer);
              const overlayGeometry = overlayRaw.index
                ? overlayRaw.toNonIndexed()
                : overlayRaw;
              overlayGeometry.computeVertexNormals();
              overlayGeometry.computeBoundingBox();
              overlayGeometry.translate(-mainCenter.x, -mainCenter.y, -mainCenter.z);
              overlayGeometry.computeBoundingBox();
              const overlayOpacity = Math.min(
                0.95,
                Math.max(0.15, meshOverlayOpacity)
              );
              overlayMaterial = new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(0xff3b30),
                emissive: new THREE.Color(0x8b1510),
                roughness: 0.25,
                metalness: 0.05,
                clearcoat: 0.55,
                clearcoatRoughness: 0.25,
                transmission: 0.08,
                thickness: 0.4,
                transparent: true,
                opacity: overlayOpacity,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1,
                side: THREE.DoubleSide,
              });
              overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
              overlayMesh.renderOrder = 4;
              overlayMesh.frustumCulled = false;
              scene.add(overlayMesh);
            }
          } catch {
            // overlay is optional
          }
        }
        camera.position.set(0, 0, maxDim * 1.6);
        camera.near = Math.max(0.1, maxDim * 0.02);
        camera.far = Math.max(200, maxDim * 6);
        camera.updateProjectionMatrix();
        controls.update();

        const grid = new THREE.GridHelper(
          maxDim * 2.2,
          24,
          0x1f2937,
          0x0f172a
        );
        if ("material" in grid) {
          const gridMaterial = grid.material as any;
          gridMaterial.opacity = 0.35;
          gridMaterial.transparent = true;
        }
        grid.position.set(0, -maxDim * 0.55, 0);
        scene.add(grid);

        const vertexCount = sourceGeometry.attributes.position.count;
        setMeshVertexCount(vertexCount);
        const canSculpt = vertexCount <= MAX_MESH_SCULPT_VERTICES;
        setMeshCanSculpt(canSculpt);

        const boundsPayload: MeshBounds = {
          min: [bounds.min.x, bounds.min.y, bounds.min.z],
          max: [bounds.max.x, bounds.max.y, bounds.max.z],
        };

        const meshIndexMap = new Map<any, number>();
        meshParts.forEach((part, index) => {
          meshIndexMap.set(part.mesh, index);
        });

        meshStateRef.current = {
          three: THREE,
          renderer,
          scene,
          camera,
          controls,
          meshGroup,
          meshParts,
          sourceGeometry,
          material,
          overlayMesh,
          overlayMaterial,
          clipPlane: null,
          bounds: boundsPayload,
          maxDim,
          activePartIndex: 0,
        };

        clearMeshSelection();
        setMeshPartCount(meshParts.length);
        setMeshActiveGroup(0);
        setMeshSelectionCount(0);
        setMeshPartOffsets({});

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();

        let ctrlOrbitActive = false;
        let orbitOverrideActive = false;
        let orbitPointer = { x: 0, y: 0 };
        let orbitPointerId: number | null = null;
        let panOverrideActive = false;
        let panPointer = { x: 0, y: 0 };
        let panPointerId: number | null = null;
        const orbitSpherical = new THREE.Spherical();
        const orbitOffset = new THREE.Vector3();
        const orbitTarget = new THREE.Vector3();
        const zoomTarget = new THREE.Vector3();
        const zoomOffset = new THREE.Vector3();
        const panTarget = new THREE.Vector3();
        const panRight = new THREE.Vector3();
        const panUp = new THREE.Vector3();
        const panOffset = new THREE.Vector3();

        const applySculpt = (
          partIndex: number,
          point: [number, number, number],
          direction: number
        ) => {
          const part = meshParts[partIndex];
          if (!part) return;
          const positions = part.geometry.attributes.position;
          const normals = part.geometry.attributes.normal;
          const posArray = positions.array as Float32Array;
          const normArray = normals.array as Float32Array;
          const radius = Math.max(0.1, meshBrushRef.current);
          const strength = meshStrengthRef.current;
          const radiusSq = radius * radius;
          const px = point[0];
          const py = point[1];
          const pz = point[2];
          let changed = false;

          for (let i = 0; i < posArray.length; i += 3) {
            const dx = posArray[i] - px;
            const dy = posArray[i + 1] - py;
            const dz = posArray[i + 2] - pz;
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq > radiusSq) continue;
            const falloff = 1 - Math.sqrt(distSq) / radius;
            const displacement = strength * falloff * direction;
            posArray[i] += normArray[i] * displacement;
            posArray[i + 1] += normArray[i + 1] * displacement;
            posArray[i + 2] += normArray[i + 2] * displacement;
            changed = true;
          }

          if (changed) {
            positions.needsUpdate = true;
            part.geometry.computeVertexNormals();
            normals.needsUpdate = true;
          }
        };

        const scheduleSculpt = (
          partIndex: number,
          point: [number, number, number],
          direction: number
        ) => {
          meshPendingRef.current = { point, direction, partIndex };
          if (meshRafRef.current) return;
          meshRafRef.current = window.requestAnimationFrame(() => {
            const pending = meshPendingRef.current;
            if (pending) {
              applySculpt(pending.partIndex, pending.point, pending.direction);
            }
            meshPendingRef.current = null;
            meshRafRef.current = 0;
          });
        };

        const selectVertices = (partIndex: number, hit: any) => {
          const part = meshParts[partIndex];
          if (!part) return;
          const selectionRadius =
            (Math.max(0.5, meshSelectionRadiusRef.current) / 100) * maxDim;
          const radiusSq = selectionRadius * selectionRadius;
          const positions = part.geometry.attributes.position
            .array as Float32Array;
          const vertexCount = part.geometry.attributes.position.count;
          const precisionPick = meshSelectionPrecisionRef.current;
          const stride = precisionPick
            ? 1
            : vertexCount > 60000
              ? Math.ceil(vertexCount / 60000)
              : 1;
          const indices = new Set<number>();
          if (hit?.face) {
            [hit.face.a, hit.face.b, hit.face.c].forEach((index: number) => {
              if (index >= 0 && index < vertexCount) {
                indices.add(index);
              }
            });
          }
          const px = hit.point.x;
          const py = hit.point.y;
          const pz = hit.point.z;
          for (let i = 0; i < vertexCount; i += stride) {
            const offset = i * 3;
            const dx = positions[offset] - px;
            const dy = positions[offset + 1] - py;
            const dz = positions[offset + 2] - pz;
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq <= radiusSq) {
              indices.add(i);
            }
          }
          if (!indices.size) {
            clearMeshSelection();
            return;
          }
          rebuildMeshSelectionOverlay(partIndex, indices);
        };

        const handlePointer = (event: PointerEvent) => {
          const tool = meshToolRef.current;
          if (tool === "orbit") return;
          if ((tool === "sculpt" || tool === "carve") && !canSculpt) return;
          if (
            (tool === "sculpt" || tool === "carve") &&
            meshExplodeEnabledRef.current
          ) {
            return;
          }
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hits = raycaster.intersectObjects(
            meshParts.map((part) => part.mesh),
            false
          );
          if (!hits.length) return;
          const hit = hits[0];
          const partIndex = meshIndexMap.get(hit.object) ?? 0;
          if (tool === "select") {
            selectVertices(partIndex, hit);
            return;
          }
          const direction = tool === "carve" ? -1 : 1;
          scheduleSculpt(partIndex, [hit.point.x, hit.point.y, hit.point.z], direction);
        };

        let orbitHoverActive = false;

        const setOrbitHoverCursor = (enabled: boolean) => {
          if (!orbitHoverActive) return;
          renderer.domElement.style.cursor = enabled ? "grab" : "";
        };

        const onPointerDownCapture = (event: PointerEvent) => {
          if (event.button !== 0) return;
          if (!(event.shiftKey || event.ctrlKey)) return;
          orbitOverrideActive = true;
          controls.enabled = false;
          meshSculptingRef.current = false;
          orbitPointer = { x: event.clientX, y: event.clientY };
          orbitPointerId = event.pointerId;
          renderer.domElement.setPointerCapture(event.pointerId);
          event.preventDefault();
          event.stopImmediatePropagation();
          ctrlOrbitActive = event.ctrlKey;
          renderer.domElement.style.cursor = event.ctrlKey ? "grabbing" : "";
        };

        const onRightPointerDownCapture = (event: PointerEvent) => {
          if (event.button !== 2) return;
          if (orbitOverrideActive || panOverrideActive) return;
          panOverrideActive = true;
          controls.enabled = false;
          meshSculptingRef.current = false;
          panPointer = { x: event.clientX, y: event.clientY };
          panPointerId = event.pointerId;
          renderer.domElement.setPointerCapture(event.pointerId);
          renderer.domElement.style.cursor = "grabbing";
          event.preventDefault();
          event.stopImmediatePropagation();
        };

        const onPointerDown = (event: PointerEvent) => {
          const tool = meshToolRef.current;
          if (orbitOverrideActive || panOverrideActive) return;
          if (tool === "orbit") return;
          if (tool === "select") {
            handlePointer(event);
            return;
          }
          if (!canSculpt || meshExplodeEnabledRef.current) return;
          meshSculptingRef.current = true;
          handlePointer(event);
        };

        const onPointerMove = (event: PointerEvent) => {
          if (orbitOverrideActive) {
            if (orbitPointerId !== null && event.pointerId !== orbitPointerId) {
              return;
            }
            const element = renderer.domElement;
            const deltaX = event.clientX - orbitPointer.x;
            const deltaY = event.clientY - orbitPointer.y;
            orbitPointer = { x: event.clientX, y: event.clientY };
            const height = element.clientHeight || 1;
            const width = element.clientWidth || 1;
            const rotateSpeed = controls.rotateSpeed ?? 1;
            const azimuthDelta = (2 * Math.PI * deltaX * rotateSpeed) / width;
            const polarDelta = (2 * Math.PI * deltaY * rotateSpeed) / height;
            if ("target" in controls && controls.target) {
              orbitTarget.copy(controls.target);
            } else {
              orbitTarget.set(0, 0, 0);
            }
            orbitOffset.copy(camera.position).sub(orbitTarget);
            orbitSpherical.setFromVector3(orbitOffset);
            orbitSpherical.theta -= azimuthDelta;
            orbitSpherical.phi -= polarDelta;
            const EPS = 1e-6;
            orbitSpherical.phi = Math.max(
              EPS,
              Math.min(Math.PI - EPS, orbitSpherical.phi)
            );
            orbitOffset.setFromSpherical(orbitSpherical);
            camera.position.copy(orbitTarget).add(orbitOffset);
            camera.lookAt(orbitTarget);
            controls.update();
            return;
          }
          if (panOverrideActive) {
            if (panPointerId !== null && event.pointerId !== panPointerId) {
              return;
            }
            const element = renderer.domElement;
            const deltaX = event.clientX - panPointer.x;
            const deltaY = event.clientY - panPointer.y;
            panPointer = { x: event.clientX, y: event.clientY };
            const height = element.clientHeight || 1;
            if ("target" in controls && controls.target) {
              panTarget.copy(controls.target);
            } else {
              panTarget.set(0, 0, 0);
            }
            panOffset.copy(camera.position).sub(panTarget);
            const distance = panOffset.length() || 1;
            const fov = (camera.fov * Math.PI) / 180;
            const targetDistance = distance * Math.tan(fov / 2);
            const panX = (-2 * deltaX * targetDistance) / height;
            const panY = (2 * deltaY * targetDistance) / height;
            camera.updateMatrix();
            panRight.setFromMatrixColumn(camera.matrix, 0).multiplyScalar(panX);
            panUp.setFromMatrixColumn(camera.matrix, 1).multiplyScalar(panY);
            panOffset.copy(panRight).add(panUp);
            camera.position.add(panOffset);
            panTarget.add(panOffset);
            if ("target" in controls && controls.target) {
              controls.target.copy(panTarget);
            }
            camera.lookAt(panTarget);
            controls.update();
            return;
          }
          if (!meshSculptingRef.current) return;
          handlePointer(event);
        };

        const onWheel = (event: WheelEvent) => {
          if (meshToolRef.current === "orbit") return;
          event.preventDefault();
          const delta = event.deltaY;
          if (!Number.isFinite(delta) || delta === 0) return;
          const zoomIntensity = Math.min(Math.abs(delta) / 120, 6);
          if (typeof controls.dollyIn === "function") {
            const scale = 1 + zoomIntensity * 0.08;
            if (delta > 0) {
              controls.dollyOut(scale);
            } else {
              controls.dollyIn(scale);
            }
            controls.update();
            return;
          }
          if ("target" in controls && controls.target) {
            zoomTarget.copy(controls.target);
          } else {
            zoomTarget.set(0, 0, 0);
          }
          zoomOffset.copy(camera.position).sub(zoomTarget);
          const distance = zoomOffset.length();
          const minDistance =
            typeof controls.minDistance === "number" ? controls.minDistance : 0.1;
          const maxDistance =
            typeof controls.maxDistance === "number"
              ? controls.maxDistance
              : maxDim * 6;
          const step = zoomIntensity * maxDim * 0.04;
          const nextDistance = Math.min(
            maxDistance,
            Math.max(minDistance, distance + (delta > 0 ? step : -step))
          );
          zoomOffset.setLength(nextDistance);
          camera.position.copy(zoomTarget).add(zoomOffset);
          camera.lookAt(zoomTarget);
          controls.update();
        };

        const onPointerUp = (event: PointerEvent) => {
          meshSculptingRef.current = false;
          meshPendingRef.current = null;
          if (orbitOverrideActive) {
            if (orbitPointerId !== null) {
              renderer.domElement.releasePointerCapture(orbitPointerId);
            }
            orbitOverrideActive = false;
            orbitPointerId = null;
            if (ctrlOrbitActive) {
              ctrlOrbitActive = false;
              renderer.domElement.style.cursor = orbitHoverActive ? "grab" : "";
            }
            controls.enabled = meshToolRef.current === "orbit";
          }
          if (panOverrideActive) {
            if (panPointerId !== null) {
              renderer.domElement.releasePointerCapture(panPointerId);
            }
            panOverrideActive = false;
            panPointerId = null;
            renderer.domElement.style.cursor = orbitHoverActive ? "grab" : "";
            controls.enabled = meshToolRef.current === "orbit";
          }
        };

        const onPointerEnter = () => {
          orbitHoverActive = true;
          setOrbitHoverCursor(true);
        };

        const onPointerLeave = () => {
          orbitHoverActive = false;
          renderer.domElement.style.cursor = "";
        };

        const onKeyToggle = (event: KeyboardEvent) => {
          if (orbitOverrideActive) return;
          setOrbitHoverCursor(event.ctrlKey);
        };

        const onContextMenu = (event: Event) => {
          event.preventDefault();
        };

        renderer.domElement.addEventListener(
          "pointerdown",
          onPointerDownCapture,
          true
        );
        renderer.domElement.addEventListener(
          "pointerdown",
          onRightPointerDownCapture,
          true
        );
        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerenter", onPointerEnter);
        renderer.domElement.addEventListener("pointerleave", onPointerLeave);
        renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
        renderer.domElement.addEventListener("contextmenu", onContextMenu);
        window.addEventListener("keydown", onKeyToggle);
        window.addEventListener("keyup", onKeyToggle);
        window.addEventListener("pointerup", onPointerUp);

        const resize = () => {
          const bounds = container.getBoundingClientRect();
          const width = Math.max(1, bounds.width);
          const height = Math.max(1, bounds.height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        };

        const resizeObserver =
          "ResizeObserver" in window ? new ResizeObserver(resize) : null;
        if (resizeObserver) {
          resizeObserver.observe(container);
        } else {
          window.addEventListener("resize", resize);
        }
        resize();

        let animationId = 0;
        const animate = () => {
          animationId = window.requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        meshCleanupRef.current = () => {
          if (animationId) window.cancelAnimationFrame(animationId);
          resizeObserver?.disconnect();
          window.removeEventListener("resize", resize);
          renderer.domElement.removeEventListener(
            "pointerdown",
            onPointerDownCapture,
            true
          );
          renderer.domElement.removeEventListener(
            "pointerdown",
            onRightPointerDownCapture,
            true
          );
          renderer.domElement.removeEventListener("pointerdown", onPointerDown);
          renderer.domElement.removeEventListener("pointermove", onPointerMove);
          renderer.domElement.removeEventListener("pointerenter", onPointerEnter);
          renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
          renderer.domElement.removeEventListener("wheel", onWheel);
          renderer.domElement.removeEventListener("contextmenu", onContextMenu);
          window.removeEventListener("keydown", onKeyToggle);
          window.removeEventListener("keyup", onKeyToggle);
          window.removeEventListener("pointerup", onPointerUp);
          clearMeshSelection();
          controls.dispose();
          grid.removeFromParent();
          grid.geometry.dispose();
          if ("material" in grid) {
            const gridMaterial = grid.material as any;
            if (Array.isArray(gridMaterial)) {
              gridMaterial.forEach((materialItem) => materialItem.dispose());
            } else {
              gridMaterial.dispose?.();
            }
          }
          meshParts.forEach((part) => {
            part.mesh.removeFromParent();
            part.geometry.dispose();
          });
          if (overlayMesh) {
            overlayMesh.removeFromParent();
            overlayMesh.geometry?.dispose?.();
          }
          meshGroup.removeFromParent();
          material.dispose();
          if (overlayMaterial) {
            overlayMaterial.dispose();
          }
          renderer.dispose();
          container.replaceChildren();
          meshStateRef.current = null;
          if (meshRafRef.current) {
            window.cancelAnimationFrame(meshRafRef.current);
            meshRafRef.current = 0;
          }
          meshPendingRef.current = null;
        };
      } catch (e: unknown) {
        if (cancelled) return;
        const message =
          e instanceof Error ? e.message : "Failed to initialize mesh viewer.";
        setMeshError(message);
      } finally {
        if (!cancelled) {
          setMeshLoading(false);
        }
      }
    };

    void initMeshViewer();

    return () => {
      cancelled = true;
      if (meshCleanupRef.current) {
        meshCleanupRef.current();
        meshCleanupRef.current = null;
      }
    };
  }, [
    viewerMode,
    viewer3dMode,
    meshPrimaryPath,
    meshOverlayPath,
    meshOverlayIso,
    meshOverlayStep,
    meshOverlayOpacity,
    meshSource,
    meshMaskAvailable,
    meshRevision,
    buildMeshUrl,
    apiFetch,
    isAuthenticated,
  ]);

  useEffect(() => {
    const state = meshStateRef.current;
    if (!state) return;
    state.controls.enabled = meshTool === "orbit";
    if (meshTool === "select") {
      meshSculptingRef.current = false;
      meshPendingRef.current = null;
    }
  }, [meshTool]);

  useEffect(() => {
    if (meshCanSculpt) return;
    if (meshTool !== "orbit" && meshTool !== "select") {
      setMeshTool("orbit");
    }
  }, [meshCanSculpt, meshTool]);

  useEffect(() => {
    const state = meshStateRef.current;
    if (!state) return;
    state.material.wireframe = meshWireframe;
    state.material.needsUpdate = true;
  }, [meshWireframe]);

  useEffect(() => {
    if (meshPartCount <= 1 && meshIsolateEnabled) {
      setMeshIsolateEnabled(false);
    }
  }, [meshPartCount, meshIsolateEnabled]);

  useEffect(() => {
    if (!meshPartCount) return;
    setMeshActiveGroup((value) =>
      Math.min(Math.max(0, value), Math.max(0, meshPartCount - 1))
    );
  }, [meshPartCount]);

  useEffect(() => {
    const state = meshStateRef.current;
    if (!state) return;
    state.activePartIndex = meshActiveGroup;
  }, [meshActiveGroup]);

  useEffect(() => {
    const state = meshStateRef.current;
    if (!state) return;
    state.meshParts.forEach((part, index) => {
      part.mesh.visible = !meshIsolateEnabled || index === meshActiveGroup;
    });
  }, [meshIsolateEnabled, meshActiveGroup, meshRevision]);

  useEffect(() => {
    const state = meshStateRef.current;
    if (!state) return;
    const preset = MESH_MATERIAL_PRESETS[meshMaterialPreset];
    const material = state.material;
    material.color.setHex(preset.color);
    material.roughness = preset.roughness;
    material.metalness = preset.metalness;
    material.clearcoat = preset.clearcoat ?? 0;
    material.clearcoatRoughness = preset.clearcoatRoughness ?? 0;
    material.transmission = preset.transmission ?? 0;
    material.thickness = preset.thickness ?? 0;
    material.ior = preset.ior ?? 1.5;
    material.sheen = preset.sheen ?? 0;
    material.sheenColor = new state.three.Color(preset.sheenColor ?? 0x000000);
    material.emissive = new state.three.Color(preset.emissive ?? 0x000000);
    material.transparent = (preset.transmission ?? 0) > 0;
    material.needsUpdate = true;
  }, [meshMaterialPreset]);

  useEffect(() => {
    if (!meshExplodeEnabled) return;
    if (meshTool === "sculpt" || meshTool === "carve") {
      setMeshTool("orbit");
    }
    meshSculptingRef.current = false;
  }, [meshExplodeEnabled, meshTool]);

  useEffect(() => {
    const state = meshStateRef.current;
    if (!state) return;
    const baseDistance = meshExplodeEnabled
      ? meshExplodeDistance * state.maxDim * 0.6
      : 0;
    state.meshParts.forEach((part, index) => {
      const offset = (meshPartOffsets[index] ?? 0) * state.maxDim * 0.45;
      const distance = baseDistance + offset;
      part.mesh.position.set(
        part.direction[0] * distance,
        part.direction[1] * distance,
        part.direction[2] * distance
      );
    });
  }, [meshExplodeEnabled, meshExplodeDistance, meshPartOffsets, meshRevision]);

  useEffect(() => {
    const state = meshStateRef.current;
    if (!state) return;
    const { three, material, bounds, overlayMaterial } = state;
    if (!meshClipEnabled) {
      material.clippingPlanes = [];
      material.needsUpdate = true;
      if (overlayMaterial) {
        overlayMaterial.clippingPlanes = [];
        overlayMaterial.needsUpdate = true;
      }
      return;
    }
    const plane = state.clipPlane ?? new three.Plane();
    const axisIndex =
      meshClipAxis === "x" ? 0 : meshClipAxis === "y" ? 1 : 2;
    const min = bounds.min[axisIndex];
    const max = bounds.max[axisIndex];
    const value = min + (max - min) * meshClipValue;
    const normal =
      meshClipAxis === "x"
        ? new three.Vector3(1, 0, 0)
        : meshClipAxis === "y"
          ? new three.Vector3(0, 1, 0)
          : new three.Vector3(0, 0, 1);
    const point = new three.Vector3(
      meshClipAxis === "x" ? value : 0,
      meshClipAxis === "y" ? value : 0,
      meshClipAxis === "z" ? value : 0
    );
    plane.setFromNormalAndCoplanarPoint(normal, point);
    state.clipPlane = plane;
    material.clippingPlanes = [plane];
    material.needsUpdate = true;
    if (overlayMaterial) {
      overlayMaterial.clippingPlanes = [plane];
      overlayMaterial.needsUpdate = true;
    }
  }, [meshClipEnabled, meshClipAxis, meshClipValue]);

  useEffect(() => {
    const state = viewer3dStateRef.current;
    if (!state) return;
    const [min, max] = state.dataRange;
    const range = max - min || 1;
    const stops =
      VOLUME_COLOR_STOPS[volumeColormap] ?? VOLUME_COLOR_STOPS.radiance;
    state.ctfun.removeAllPoints();
    stops.forEach(([stop, color]) => {
      const value = min + range * stop;
      state.ctfun.addRGBPoint(value, color[0], color[1], color[2]);
    });
    state.renderWindow.render();
  }, [volumeColormap]);

  useEffect(() => {
    const state = viewer3dStateRef.current;
    if (!state) return;
    const [min, max] = state.dataRange;
    const range = max - min || 1;
    const mid = min + range * 0.5;
    const hi = min + range * 0.85;
    const opacityScale = Math.max(0, Math.min(volumeOpacity, 1));
    state.ofun.removeAllPoints();
    state.ofun.addPoint(min, 0.0);
    state.ofun.addPoint(mid, 0.05 * opacityScale);
    state.ofun.addPoint(hi, 0.25 * opacityScale);
    state.ofun.addPoint(max, 0.9 * opacityScale);
    state.renderWindow.render();
  }, [volumeOpacity]);

  useEffect(() => {
    const state = viewer3dStateRef.current;
    if (!state) return;
    state.volumeMapper.removeAllClippingPlanes();
    if (clipEnabled) {
      const vtkPlane = vtkPlaneRef.current;
      if (!vtkPlane) return;
      const plane = state.clipPlane ?? vtkPlane.newInstance();
      const [dx, dy, dz] = state.dimensions;
      const [sx, sy, sz] = state.spacing;
      const maxX = dx * sx;
      const maxY = dy * sy;
      const maxZ = dz * sz;
      const value = Math.max(0, Math.min(clipValue, 1));
      if (clipAxis === "x") {
        plane.setNormal(1, 0, 0);
        plane.setOrigin(maxX * value, 0, 0);
      } else if (clipAxis === "y") {
        plane.setNormal(0, 1, 0);
        plane.setOrigin(0, maxY * value, 0);
      } else {
        plane.setNormal(0, 0, 1);
        plane.setOrigin(0, 0, maxZ * value);
      }
      state.volumeMapper.addClippingPlane(plane);
      state.clipPlane = plane;
    } else {
      state.clipPlane = null;
    }
    state.renderWindow.render();
  }, [clipEnabled, clipAxis, clipValue]);

  useEffect(() => {
    if (AUTH_REQUIRED && !isAuthenticated) return undefined;
    if (!jobId) return undefined;

    let active = true;
    let timeoutId: number | undefined;

    const poll = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/api/results/${jobId}`);
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
  }, [jobId, pushNotice, apiFetch, isAuthenticated]);

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
      if (authToken) {
        params.set("token", authToken);
      }
      return `${API_BASE}/api/uploads/slice?${params.toString()}`;
    },
    [uploadPath, viewerChannel, sliceColormap, authToken]
  );

  useEffect(() => {
    if (!uploadPath || !axisSizes) {
      slicePrefetchRef.current = null;
      return;
    }
    const previous = slicePrefetchRef.current;
    slicePrefetchRef.current = sliceRequestIndex;
    if (!previous) return;

    (["sagittal", "coronal", "axial"] as AxisKey[]).forEach((axis) => {
      if (sliceRequestIndex[axis] === previous[axis]) return;
      const maxIndex = Math.max(0, axisSizes[axis] - 1);
      if (maxIndex === 0) return;
      const current = sliceRequestIndex[axis];
      const candidates = [
        Math.max(0, current - 1),
        Math.min(maxIndex, current + 1),
      ];
      candidates.forEach((candidate) => {
        if (candidate === current) return;
        const url = buildSliceUrl(axis, candidate);
        if (!url) return;
        const img = new Image();
        img.decoding = "async";
        img.loading = "eager";
        img.src = url;
      });
    });
  }, [sliceRequestIndex, axisSizes, uploadPath, buildSliceUrl]);

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
    if (workspacePath) {
      setWorkspacePath("");
    }
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

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authUsername || !authPassword) {
      setAuthError("Enter your username and password to continue.");
      return;
    }
    try {
      setAuthError("");
      setAuthNotice("");
      setAuthLoading(true);
      const res = await fetch(`${AUTH_BASE}/api/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername.trim(),
          password: authPassword,
        }),
      });
      const payload = (await res.json().catch(() => null)) as
        | Record<string, unknown>
        | null;
      if (!res.ok) {
        const detail =
          (typeof payload?.detail === "string" && payload.detail) ||
          (Array.isArray(payload?.detail) && payload?.detail[0]) ||
          (Array.isArray(payload?.non_field_errors) &&
            payload?.non_field_errors[0]) ||
          "Invalid credentials. Please try again.";
        throw new Error(detail);
      }
      const data = payload as AuthTokens;
      localStorage.setItem(AUTH_TOKEN_KEY, data.access);
      localStorage.setItem(AUTH_REFRESH_KEY, data.refresh);
      setAuthToken(data.access);
      setAuthRefresh(data.refresh);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Unable to sign in right now.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setAuthError("");
    setAuthNotice("");
    setAuthUsername("");
    setAuthPassword("");
    resetAuthFlow();
  };

  const requestPasswordCode = useCallback(
    async (identifier: string): Promise<string> => {
      const res = await fetch(`${AUTH_BASE}/api/password/forgot/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = (await res.json().catch(() => null)) as
        | PasswordResetResponse
        | null;
      if (!res.ok) {
        throw new Error(data?.detail || "Unable to send the code.");
      }
      return data?.detail || "Check your email for the code.";
    },
    []
  );

  const handleForgotStart = () => {
    setAuthError("");
    setAuthNotice("");
    setForgotError("");
    setForgotNotice("");
    setAuthStep("forgot-request");
  };

  const handleForgotCancel = () => {
    setForgotError("");
    setForgotNotice("");
    setForgotOtp("");
    setForgotPassword("");
    setForgotConfirm("");
    setAuthStep("login");
  };

  const handleForgotRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!forgotIdentifier.trim()) {
      setForgotError("Enter your email or username.");
      return;
    }
    try {
      setForgotError("");
      setForgotNotice("");
      setForgotLoading(true);
      const detail = await requestPasswordCode(forgotIdentifier.trim());
      setForgotNotice(detail);
      setAuthStep("forgot-verify");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Unable to send the code.";
      setForgotError(message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotResend = async () => {
    if (!forgotIdentifier.trim()) {
      setForgotError("Enter your email or username.");
      return;
    }
    try {
      setForgotError("");
      setForgotNotice("");
      setForgotLoading(true);
      const detail = await requestPasswordCode(forgotIdentifier.trim());
      setForgotNotice(detail);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Unable to resend the code.";
      setForgotError(message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!forgotOtp.trim() || !forgotPassword || !forgotConfirm) {
      setForgotError("Complete every field to continue.");
      return;
    }
    if (forgotPassword !== forgotConfirm) {
      setForgotError("Passwords do not match.");
      return;
    }
    try {
      setForgotError("");
      setForgotNotice("");
      setForgotLoading(true);
      const res = await fetch(`${AUTH_BASE}/api/password/reset/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: forgotIdentifier.trim(),
          otp: forgotOtp.trim(),
          new_password: forgotPassword,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | PasswordResetResponse
        | null;
      if (!res.ok) {
        throw new Error(data?.detail || "Unable to reset the password.");
      }
      setAuthNotice("Password updated. Sign in with your new password.");
      setAuthStep("login");
      setForgotOtp("");
      setForgotPassword("");
      setForgotConfirm("");
      setForgotError("");
      setForgotNotice("");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Unable to reset the password.";
      setForgotError(message);
    } finally {
      setForgotLoading(false);
    }
  };

  const requestVerificationCode = useCallback(
    async (identifier: string): Promise<PasswordResetResponse> => {
      const res = await fetch(`${AUTH_BASE}/api/email/verify/request/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = (await res.json().catch(() => null)) as
        | PasswordResetResponse
        | null;
      if (!res.ok) {
        throw new Error(data?.detail || "Unable to send the verification code.");
      }
      return {
        detail: data?.detail || "Check your email for the code.",
        already_verified: data?.already_verified,
      };
    },
    []
  );

  const handleVerifyStart = () => {
    setAuthError("");
    setAuthNotice("");
    setVerifyError("");
    setVerifyNotice("");
    setAuthStep("verify-request");
  };

  const handleVerifyCancel = () => {
    setVerifyError("");
    setVerifyNotice("");
    setVerifyOtp("");
    setAuthStep("login");
  };

  const handleVerifyRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verifyIdentifier.trim()) {
      setVerifyError("Enter your email or username.");
      return;
    }
    try {
      setVerifyError("");
      setVerifyNotice("");
      setVerifyLoading(true);
      const response = await requestVerificationCode(verifyIdentifier.trim());
      if (response.already_verified) {
        setAuthNotice("Email already verified. You can sign in now.");
        setAuthStep("login");
        return;
      }
      setVerifyNotice(response.detail);
      setAuthStep("verify-confirm");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Unable to send the verification code.";
      setVerifyError(message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyResend = async () => {
    if (!verifyIdentifier.trim()) {
      setVerifyError("Enter your email or username.");
      return;
    }
    try {
      setVerifyError("");
      setVerifyNotice("");
      setVerifyLoading(true);
      const response = await requestVerificationCode(verifyIdentifier.trim());
      if (response.already_verified) {
        setAuthNotice("Email already verified. You can sign in now.");
        setAuthStep("login");
        return;
      }
      setVerifyNotice(response.detail);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Unable to resend the code.";
      setVerifyError(message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verifyIdentifier.trim() || !verifyOtp.trim()) {
      setVerifyError("Enter the code and your email or username.");
      return;
    }
    try {
      setVerifyError("");
      setVerifyNotice("");
      setVerifyLoading(true);
      const res = await fetch(`${AUTH_BASE}/api/email/verify/confirm/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: verifyIdentifier.trim(),
          otp: verifyOtp.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | PasswordResetResponse
        | null;
      if (!res.ok) {
        throw new Error(data?.detail || "Unable to verify the email.");
      }
      setAuthNotice("Email verified. You can sign in now.");
      setAuthStep("login");
      setVerifyOtp("");
      setVerifyError("");
      setVerifyNotice("");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Unable to verify the email.";
      setVerifyError(message);
    } finally {
      setVerifyLoading(false);
    }
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
      const res = await apiFetch(`${API_BASE}${endpoint}`, {
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
        const previewRes = await apiFetch(
          `${API_BASE}/api/uploads/preview?path=${encodeURIComponent(savedPath)}`
        );
        if (previewRes.ok) {
          const preview = (await previewRes.json()) as UploadPreview;
          setUploadPreview(preview);
          setPreviewPath(savedPath);
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

      const res = await apiFetch(`${API_BASE}/api/segment`, {
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

  const handleReportFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      setReportFile(file);
      setReportResult(null);
      setReportError("");
      setReportNotice("");
      setReportValueQuery("");
      setReportOnlyAbnormal(false);
    },
    []
  );

  const handleAnalyzeReport = useCallback(async () => {
    if (!reportFile) {
      setReportError("Select a report file to analyze.");
      return;
    }
    try {
      setReportError("");
      setReportNotice("");
      setReportLoading(true);
      const form = new FormData();
      form.append("file", reportFile);
      const res = await apiFetch(`${API_BASE}/api/reports/analyze`, {
        method: "POST",
        body: form,
      });
      const payload = (await res.json().catch(() => null)) as
        | ReportAnalysisResponse
        | { detail?: string }
        | null;
      if (!res.ok) {
        throw new Error(
          payload && "detail" in payload && payload.detail
            ? payload.detail
            : `Report analysis failed (${res.status})`
        );
      }
      if (payload && "extracted_values" in payload) {
        setReportResult(payload as ReportAnalysisResponse);
        setReportNotice("Report analysis complete.");
      } else {
        throw new Error("Unexpected response from report analysis.");
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Report analysis failed.";
      setReportError(message);
    } finally {
      setReportLoading(false);
    }
  }, [apiFetch, reportFile]);

  const labelMap = useMemo(() => {
    const map = new Map<string, Label>();
    labels.forEach((label) => {
      map.set(label.id, label);
    });
    return map;
  }, [labels]);

  useEffect(() => {
    if (!labels.length) return;
    if (!labelMap.has(activeLabelId)) {
      setActiveLabelId(labels[0].id);
    }
  }, [labels, labelMap, activeLabelId]);

  const getAnnotationKey = useCallback(
    (axis: AxisKey) => `${axis}-${sliceIndex[axis]}-${viewerChannel}`,
    [sliceIndex, viewerChannel]
  );

  const getAnnotationSet = useCallback((key: string) => {
    const existing = annotationsRef.current[key];
    if (existing) return existing;
    const created = { items: [] };
    annotationsRef.current[key] = created;
    return created;
  }, []);

  const clamp01 = (value: number) => Math.max(0, Math.min(value, 1));
  const getImageFrame = (
    canvas: HTMLCanvasElement,
    image: HTMLImageElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width <= 0 || height <= 0) {
      return null;
    }
    const imageWidth = image.naturalWidth || width;
    const imageHeight = image.naturalHeight || height;
    const imageRatio = imageWidth / imageHeight;
    const containerRatio = width / height;
    let contentWidth = width;
    let contentHeight = height;
    let offsetX = 0;
    let offsetY = 0;
    if (imageRatio > containerRatio) {
      contentWidth = width;
      contentHeight = width / imageRatio;
      offsetY = (height - contentHeight) / 2;
    } else {
      contentHeight = height;
      contentWidth = height * imageRatio;
      offsetX = (width - contentWidth) / 2;
    }
    return { width, height, contentWidth, contentHeight, offsetX, offsetY };
  };

  const getPlaneSpacing = useCallback(
    (axis: AxisKey): [number, number] => {
      const zooms = volumeInfo?.zooms ?? [1, 1, 1];
      if (axis === "sagittal") return [zooms[1] ?? 1, zooms[2] ?? 1];
      if (axis === "coronal") return [zooms[0] ?? 1, zooms[2] ?? 1];
      return [zooms[0] ?? 1, zooms[1] ?? 1];
    },
    [volumeInfo]
  );

  const beginPanelDrag = useCallback(
    (panel: PanelId) => (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const target =
        panel === "left" ? leftPanelRef.current : rightPanelRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      dragStateRef.current = {
        panel,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      setDraggingPanel(panel);
    },
    []
  );


  useEffect(() => {
    let active = true;
    if (!AUTH_REQUIRED && !authToken) {
      setAuthChecked(true);
      return () => {
        active = false;
      };
    }
    setAuthChecked(false);
    if (!authToken) {
      setAuthUser(null);
      setAuthChecked(true);
      return () => {
        active = false;
      };
    }
    const checkAuth = async () => {
      try {
        setAuthLoading(true);
        setAuthError("");
        const res = await fetch(`${AUTH_BASE}/api/me/`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          if (res.status === 401) {
            if (active) {
              clearAuthSession();
              setAuthError("Session expired. Please sign in again.");
            }
            return;
          }
          throw new Error(`Auth check failed (${res.status})`);
        }
        const data = (await res.json()) as AuthUser;
        if (active) setAuthUser(data);
      } catch (e: unknown) {
        if (!active) return;
        const message =
          e instanceof Error ? e.message : "Unable to verify session.";
        setAuthError(message);
      } finally {
        if (active) {
          setAuthLoading(false);
          setAuthChecked(true);
        }
      }
    };
    void checkAuth();
    return () => {
      active = false;
    };
  }, [authToken, clearAuthSession]);

  useEffect(() => {
    if (!showLogin) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timeline = anime.timeline({
      easing: "easeOutExpo",
      duration: 800,
    });

    timeline
      .add({
        targets: ".login-hero",
        opacity: [0, 1],
        translateY: [24, 0],
      })
      .add(
        {
          targets: ".login-card",
          opacity: [0, 1],
          translateY: [32, 0],
        },
        "-=600"
      )
      .add(
        {
          targets: ".login-accent-line",
          scaleX: [0, 1],
        },
        "-=520"
      )
      .add(
        {
          targets: ".login-point",
          opacity: [0, 1],
          translateX: [-14, 0],
          delay: anime.stagger(120),
        },
        "-=480"
      )
      .add(
        {
          targets: ".login-stat-card",
          opacity: [0, 1],
          translateY: [16, 0],
          delay: anime.stagger(120),
        },
        "-=420"
      );

    const floaters = anime({
      targets: ".login-orb",
      translateY: [0, -18],
      direction: "alternate",
      loop: true,
      easing: "easeInOutSine",
      duration: 4200,
      delay: anime.stagger(250),
    });

    const orbit = anime({
      targets: ".login-orbit",
      rotate: "1turn",
      duration: 26000,
      easing: "linear",
      loop: true,
    });

    const gridDrift = anime({
      targets: ".login-grid",
      backgroundPosition: ["0px 0px", "120px 120px"],
      duration: 18000,
      easing: "linear",
      loop: true,
    });

    const scanline = anime({
      targets: ".login-scanline",
      translateY: ["-60%", "130%"],
      duration: 4600,
      easing: "easeInOutSine",
      loop: true,
    });

    const signal = anime({
      targets: ".login-signal-bar",
      scaleY: [0.3, 1],
      direction: "alternate",
      easing: "easeInOutSine",
      duration: 900,
      delay: anime.stagger(120),
      loop: true,
    });

    const statusPulse = anime({
      targets: ".login-status-dot",
      scale: [1, 1.45],
      opacity: [0.6, 1],
      easing: "easeInOutSine",
      direction: "alternate",
      duration: 1400,
      loop: true,
    });

    const stars = anime({
      targets: ".login-star",
      opacity: [0.2, 0.85],
      scale: [0.6, 1],
      direction: "alternate",
      easing: "easeInOutSine",
      duration: 3600,
      delay: anime.stagger(220),
      loop: true,
    });

    return () => {
      timeline.pause();
      floaters.pause();
      orbit.pause();
      gridDrift.pause();
      scanline.pause();
      signal.pause();
      statusPulse.pause();
      stars.pause();
    };
  }, [showLogin]);

  useEffect(() => {
    if (!showLogin) return;
    const screen = loginScreenRef.current;
    if (!screen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    screen.style.setProperty("--login-tilt-x", "0deg");
    screen.style.setProperty("--login-tilt-y", "0deg");
    screen.style.setProperty("--login-glow-x", "50%");
    screen.style.setProperty("--login-glow-y", "50%");
  }, [showLogin]);

  const beginPanelResize = useCallback(
    (panel: PanelId, corner: ResizeCorner) =>
      (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const size = panelSizes[panel];
      const pos = panelPositions[panel];
      resizeStateRef.current = {
        panel,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: size.width,
        startHeight: size.height,
        startLeft: pos.x,
        startTop: pos.y,
        corner,
      };
      setResizingPanel(panel);
    },
    [panelSizes, panelPositions]
  );

  useEffect(() => {
    if (!draggingPanel) return undefined;
    const onMove = (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      const panelEl =
        state.panel === "left" ? leftPanelRef.current : rightPanelRef.current;
      const panelWidth = panelEl?.offsetWidth ?? panelSizes[state.panel].width;
      const panelHeight =
        panelEl?.offsetHeight ?? panelSizes[state.panel].height;
      const minX = 8;
      const minY = 56;
      const maxX = Math.max(minX, window.innerWidth - panelWidth - 8);
      const maxY = Math.max(minY, window.innerHeight - panelHeight - 8);
      const nextX = Math.min(
        maxX,
        Math.max(minX, event.clientX - state.offsetX)
      );
      const nextY = Math.min(
        maxY,
        Math.max(minY, event.clientY - state.offsetY)
      );
      const snap = 18;
      const snappedX =
        nextX - minX < snap
          ? minX
          : maxX - nextX < snap
          ? maxX
          : nextX;
      const snappedY =
        nextY - minY < snap
          ? minY
          : maxY - nextY < snap
          ? maxY
          : nextY;
      setPanelPositions((prev) => ({
        ...prev,
        [state.panel]: { x: snappedX, y: snappedY },
      }));
    };
    const onUp = () => {
      dragStateRef.current = null;
      setDraggingPanel(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingPanel, panelSizes]);

  useEffect(() => {
    if (!resizingPanel) return undefined;
    const onMove = (event: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;
      const minWidth = 220;
      const maxWidth = Math.min(520, window.innerWidth - 40);
      const minHeight = 240;
      const maxHeight = Math.min(760, window.innerHeight - 120);
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      let nextWidth = state.startWidth;
      let nextHeight = state.startHeight;
      let nextX = state.startLeft;
      let nextY = state.startTop;

      if (state.corner === "se") {
        nextWidth = state.startWidth + dx;
        nextHeight = state.startHeight + dy;
      } else if (state.corner === "ne") {
        nextWidth = state.startWidth + dx;
        nextHeight = state.startHeight - dy;
        nextY = state.startTop + dy;
      } else if (state.corner === "sw") {
        nextWidth = state.startWidth - dx;
        nextHeight = state.startHeight + dy;
        nextX = state.startLeft + dx;
      } else {
        nextWidth = state.startWidth - dx;
        nextHeight = state.startHeight - dy;
        nextX = state.startLeft + dx;
        nextY = state.startTop + dy;
      }

      nextWidth = Math.min(
        maxWidth,
        Math.max(minWidth, nextWidth)
      );
      nextHeight = Math.min(
        maxHeight,
        Math.max(minHeight, nextHeight)
      );

      if (state.corner === "nw" || state.corner === "sw") {
        nextX = state.startLeft + (state.startWidth - nextWidth);
      }
      if (state.corner === "nw" || state.corner === "ne") {
        nextY = state.startTop + (state.startHeight - nextHeight);
      }

      const minX = 8;
      const minY = 56;
      const maxX = Math.max(minX, window.innerWidth - nextWidth - 8);
      const maxY = Math.max(minY, window.innerHeight - nextHeight - 8);
      nextX = Math.min(maxX, Math.max(minX, nextX));
      nextY = Math.min(maxY, Math.max(minY, nextY));

      setPanelSizes((prev) => ({
        ...prev,
        [state.panel]: { width: nextWidth, height: nextHeight },
      }));
      setPanelPositions((prev) => ({
        ...prev,
        [state.panel]: { x: nextX, y: nextY },
      }));
    };
    const onUp = () => {
      resizeStateRef.current = null;
      setResizingPanel(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizingPanel]);

  const renderOverlay = useCallback(
    (axis: AxisKey) => {
      const canvas = canvasRefs.current[axis];
      const image = imageRefs.current[axis];
      if (!canvas || !image) return;
      const rect = image.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      const frame = getImageFrame(canvas, image);
      if (!frame) return;

      const key = getAnnotationKey(axis);
      const set = annotationsRef.current[key];
      const items = set?.items ?? [];
      const preview = drawingRef.current?.axis === axis ? drawingRef.current.item : null;
      const allItems = preview ? [...items, preview] : items;
      if (allItems.length === 0) return;

      const toPx = (point: NormPoint) => ({
        x: frame.offsetX + point.x * frame.contentWidth,
        y: frame.offsetY + point.y * frame.contentHeight,
      });

      allItems.forEach((item) => {
        const label = labelMap.get(item.labelId);
        const color = label?.color ?? "#ffffff";
        if (item.kind === "stroke" && item.points && item.points.length > 0) {
          const lineWidth = Math.max(
            1,
            (item.size ?? 0.01) * frame.contentWidth
          );
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = lineWidth;
          if (item.tool === "erase") {
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)";
            ctx.globalAlpha = 1;
          } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = color;
            ctx.globalAlpha = overlayOpacity;
          }
          ctx.beginPath();
          item.points.forEach((point, index) => {
            const px = toPx(point);
            if (index === 0) {
              ctx.moveTo(px.x, px.y);
            } else {
              ctx.lineTo(px.x, px.y);
            }
          });
          ctx.stroke();
          ctx.restore();
        }
        if (item.kind === "rect" && typeof item.x === "number") {
          const x = frame.offsetX + item.x * frame.contentWidth;
          const y = frame.offsetY + (item.y ?? 0) * frame.contentHeight;
          const w = (item.w ?? 0) * frame.contentWidth;
          const h = (item.h ?? 0) * frame.contentHeight;
          ctx.save();
          ctx.globalAlpha = overlayOpacity;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(x, y, w, h);
          ctx.restore();
        }
        if (item.kind === "measure" && typeof item.x === "number") {
          const x1 = frame.offsetX + item.x * frame.contentWidth;
          const y1 = frame.offsetY + (item.y ?? 0) * frame.contentHeight;
          const x2 = frame.offsetX + (item.x2 ?? 0) * frame.contentWidth;
          const y2 = frame.offsetY + (item.y2 ?? 0) * frame.contentHeight;
          ctx.save();
          ctx.globalAlpha = overlayOpacity;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.restore();
          if (typeof item.lengthMm === "number") {
            ctx.save();
            ctx.font = "12px 'Space Grotesk', sans-serif";
            ctx.fillStyle = color;
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            ctx.fillText(`${item.lengthMm.toFixed(1)} mm`, midX + 6, midY - 6);
            ctx.restore();
          }
        }
      });
    },
    [getAnnotationKey, labelMap, overlayOpacity]
  );

  useEffect(() => {
    if (!isWorkspace || viewerMode !== "2d") return;
    (["sagittal", "coronal", "axial"] as AxisKey[]).forEach((axis) => {
      renderOverlay(axis);
    });
  }, [
    annotationVersion,
    isWorkspace,
    renderOverlay,
    sliceIndex,
    viewerChannel,
    viewerMode,
  ]);

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (viewerMode !== "2d") return;
    const canvas = event.currentTarget;
    const axis = canvas.dataset.axis as AxisKey | undefined;
    if (!axis || !labelMap.has(activeLabelId)) return;
    const image = imageRefs.current[axis];
    if (!image) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const frame = getImageFrame(canvas, image);
    if (!frame) return;
    const point: NormPoint = {
      x: clamp01((event.clientX - rect.left - frame.offsetX) / frame.contentWidth),
      y: clamp01((event.clientY - rect.top - frame.offsetY) / frame.contentHeight),
    };
    setActiveAxis(axis);
    const size = Math.max(2, brushSize) / frame.contentWidth;
    const base: AnnotationItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      labelId: activeLabelId,
      createdAt: Date.now(),
      kind: workspaceTool === "measure" ? "measure" : workspaceTool === "rect" ? "rect" : "stroke",
    };

    if (workspaceTool === "brush" || workspaceTool === "erase") {
      drawingRef.current = {
        axis,
        start: point,
        item: {
          ...base,
          kind: "stroke",
          tool: workspaceTool,
          points: [point],
          size,
        },
      };
    } else if (workspaceTool === "rect") {
      drawingRef.current = {
        axis,
        start: point,
        item: { ...base, kind: "rect", x: point.x, y: point.y, w: 0, h: 0 },
      };
    } else {
      drawingRef.current = {
        axis,
        start: point,
        item: {
          ...base,
          kind: "measure",
          x: point.x,
          y: point.y,
          x2: point.x,
          y2: point.y,
          lengthMm: 0,
        },
      };
    }
    canvas.setPointerCapture(event.pointerId);
    renderOverlay(axis);
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    const current = drawingRef.current;
    if (!current) return;
    const canvas = event.currentTarget;
    const axis = canvas.dataset.axis as AxisKey | undefined;
    if (!axis || axis !== current.axis) return;
    const image = imageRefs.current[axis];
    if (!image) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const frame = getImageFrame(canvas, image);
    if (!frame) return;
    const point: NormPoint = {
      x: clamp01((event.clientX - rect.left - frame.offsetX) / frame.contentWidth),
      y: clamp01((event.clientY - rect.top - frame.offsetY) / frame.contentHeight),
    };
    if (current.item.kind === "stroke" && current.item.points) {
      current.item.points.push(point);
    } else if (current.item.kind === "rect") {
      current.item.w = point.x - current.start.x;
      current.item.h = point.y - current.start.y;
      current.item.x = Math.min(current.start.x, point.x);
      current.item.y = Math.min(current.start.y, point.y);
      current.item.w = Math.abs(point.x - current.start.x);
      current.item.h = Math.abs(point.y - current.start.y);
    } else if (current.item.kind === "measure") {
      current.item.x2 = point.x;
      current.item.y2 = point.y;
      const image = imageRefs.current[axis];
      if (image) {
        const [sx, sy] = getPlaneSpacing(axis);
        const dx = (point.x - current.start.x) * image.naturalWidth * sx;
        const dy = (point.y - current.start.y) * image.naturalHeight * sy;
        current.item.lengthMm = Math.sqrt(dx * dx + dy * dy);
      }
    }
    renderOverlay(axis);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const current = drawingRef.current;
    if (!current) return;
    const canvas = event.currentTarget;
    const axis = canvas.dataset.axis as AxisKey | undefined;
    if (!axis || axis !== current.axis) return;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    const key = getAnnotationKey(axis);
    const set = getAnnotationSet(key);
    if (current.item.kind === "stroke" && current.item.points?.length === 1) {
      const point = current.item.points[0];
      current.item.points = [point, point];
    }
    set.items.push(current.item);
    drawingRef.current = null;
    setAnnotationVersion((prev) => prev + 1);
    renderOverlay(axis);
  };

  const handleUndo = () => {
    const key = getAnnotationKey(activeAxis);
    const set = annotationsRef.current[key];
    if (!set || set.items.length === 0) return;
    set.items.pop();
    setAnnotationVersion((prev) => prev + 1);
  };

  const handleClearSlice = () => {
    const key = getAnnotationKey(activeAxis);
    if (annotationsRef.current[key]) {
      annotationsRef.current[key].items = [];
      setAnnotationVersion((prev) => prev + 1);
    }
  };

  const handleClearAll = () => {
    annotationsRef.current = {};
    setAnnotationVersion((prev) => prev + 1);
  };

  const handleAddLabel = () => {
    const nextId = `label-${Date.now()}`;
    const nextLabel = {
      id: nextId,
      name: `Label ${labels.length + 1}`,
      color: "#f59e0b",
    };
    setLabels((prev) => [...prev, nextLabel]);
    setActiveLabelId(nextId);
  };

  const handleRemoveLabel = (labelId: string) => {
    if (labels.length <= 1) return;
    setLabels((prev) => prev.filter((label) => label.id !== labelId));
  };

  const handleLabelUpdate = (labelId: string, patch: Partial<Label>) => {
    setLabels((prev) =>
      prev.map((label) =>
        label.id === labelId ? { ...label, ...patch } : label
      )
    );
  };

  const handleExportAnnotations = () => {
    const payload = {
      source_path: uploadPath || null,
      labels,
      annotations: annotationsRef.current,
      created_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `annotations-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openWorkspace = () => {
    if (!uploadPath || !enableViewerWorkspace) return;
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", "viewer");
    url.searchParams.set("path", uploadPath);
    window.open(url.toString(), "_blank", "noopener");
  };

  const backToWorkflowUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("workspace");
    url.searchParams.delete("path");
    return url.toString();
  }, []);

  const annotationSummary = useMemo(() => {
    const summary = { total: 0, strokes: 0, rects: 0, measures: 0 };
    Object.values(annotationsRef.current).forEach((set) => {
      set.items.forEach((item) => {
        summary.total += 1;
        if (item.kind === "stroke") summary.strokes += 1;
        if (item.kind === "rect") summary.rects += 1;
        if (item.kind === "measure") summary.measures += 1;
      });
    });
    return summary;
  }, [annotationVersion]);

  const activeSliceCount = useMemo(() => {
    const key = getAnnotationKey(activeAxis);
    const set = annotationsRef.current[key];
    return set?.items.length ?? 0;
  }, [annotationVersion, activeAxis, getAnnotationKey]);

  const loginBackdrop = (
    <div className="login-background" aria-hidden="true">
      <div className="login-orb orb-1" />
      <div className="login-orb orb-2" />
      <div className="login-orb orb-3" />
      <div className="login-orb orb-4" />
      <div className="login-orbit orbit-1" />
      <div className="login-orbit orbit-2" />
      <div className="login-beams" />
      <div className="login-grid" />
      <div className="login-constellation">
        <span className="login-star s1" />
        <span className="login-star s2" />
        <span className="login-star s3" />
        <span className="login-star s4" />
        <span className="login-star s5" />
        <span className="login-star s6" />
        <span className="login-star s7" />
        <span className="login-star s8" />
        <span className="login-star s9" />
        <span className="login-star s10" />
      </div>
      <div className="login-scanline" />
      <div className="login-noise" />
      <div className="login-vignette" />
    </div>
  );

  if (showAuthGate) {
    return (
      <div className="login-screen" ref={loginScreenRef}>
        {loginBackdrop}
        <div className="login-shell">
          <div className="login-card login-card-loading">
            <div className="login-card-glow" aria-hidden="true" />
            <div className="login-card-grid" aria-hidden="true" />
            <div className="login-spinner" />
            <h2>Preparing your workspace</h2>
            <p>Just a moment while we get things ready.</p>
          </div>
        </div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="login-screen" ref={loginScreenRef}>
        {loginBackdrop}
        <div className="login-shell">
          <div className="login-hero">
            <div className="login-hero-top">
              <span className="pill">Secure workspace | For care teams</span>
              <div className="login-status">
                <span className="login-status-dot" />
                <span>Ready for today's cases</span>
              </div>
            </div>
            <h1 className="login-title">
              Welcome to <span>Corpus Medica</span>
            </h1>
            <p className="login-lead">
              Upload scans, explore results, and share insights with your team
              in one calm, focused workspace.
            </p>
            <div className="login-accent-line" />
            <div className="login-points">
              <div className="login-point">
                Upload scans in seconds.
              </div>
              <div className="login-point">
                Run a model with one click.
              </div>
              <div className="login-point">
                Review results in 2D or 3D.
              </div>
            </div>
            <div className="login-stats">
              <div className="login-stat-card">
                <span className="label">Cases today</span>
                <strong>1,482</strong>
                <div className="login-stat-foot">Across all workspaces</div>
              </div>
              <div className="login-stat-card">
                <span className="label">Average time</span>
                <strong>4.6m</strong>
                <div className="login-signal" aria-hidden="true">
                  <span className="login-signal-bar" />
                  <span className="login-signal-bar" />
                  <span className="login-signal-bar" />
                  <span className="login-signal-bar" />
                  <span className="login-signal-bar" />
                </div>
              </div>
              <div className="login-stat-card">
                <span className="label">Teams connected</span>
                <strong>99.98%</strong>
                <div className="login-stat-foot">Available when you need it</div>
              </div>
            </div>
          </div>
          <div className="login-card">
            <div className="login-card-glow" aria-hidden="true" />
            <div className="login-card-grid" aria-hidden="true" />
            <div className="login-card-head">
              <h2>
                {isForgotFlow
                  ? authStep === "forgot-request"
                    ? "Reset your password"
                    : "Enter the code"
                  : isVerifyFlow
                    ? authStep === "verify-request"
                      ? "Verify your email"
                      : "Enter the code"
                    : "Sign in to continue"}
              </h2>
              <p>
                {isForgotFlow
                  ? authStep === "forgot-request"
                    ? "We will email a short code to verify it is you."
                    : "Check your inbox for the code we just sent."
                  : isVerifyFlow
                    ? authStep === "verify-request"
                      ? "We will send a quick code to confirm your email."
                      : "Enter the code to finish verification."
                    : "Use the account provided by your organization."}
              </p>
            </div>
            {!isAuthFlow && authNotice && (
              <div className="login-success" role="status">
                {authNotice}
              </div>
            )}
            {!isAuthFlow && authError && (
              <div className="login-error" role="alert">
                {authError}
              </div>
            )}
            {isForgotFlow && forgotNotice && (
              <div className="login-success" role="status">
                {forgotNotice}
              </div>
            )}
            {isForgotFlow && forgotError && (
              <div className="login-error" role="alert">
                {forgotError}
              </div>
            )}
            {isVerifyFlow && verifyNotice && (
              <div className="login-success" role="status">
                {verifyNotice}
              </div>
            )}
            {isVerifyFlow && verifyError && (
              <div className="login-error" role="alert">
                {verifyError}
              </div>
            )}
            {authStep === "login" && (
              <>
                <form className="login-form" onSubmit={handleLogin}>
                  <label className="login-field">
                    <span>Username or email</span>
                    <input
                      type="text"
                      value={authUsername}
                      onChange={(event) => {
                        setAuthUsername(event.target.value);
                        if (authError) setAuthError("");
                        if (authNotice) setAuthNotice("");
                      }}
                      placeholder="dr_singh or dr_singh@clinic.com"
                      autoComplete="username"
                      required
                    />
                  </label>
                  <label className="login-field">
                    <span>Password</span>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(event) => {
                        setAuthPassword(event.target.value);
                        if (authError) setAuthError("");
                        if (authNotice) setAuthNotice("");
                      }}
                      placeholder="enter your password"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-accent btn-block"
                    disabled={authLoading}
                  >
                    {authLoading ? "Signing in..." : "Sign in"}
                  </button>
                </form>
                <div className="login-links">
                  <button
                    type="button"
                    className="login-link"
                    onClick={handleForgotStart}
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    className="login-link"
                    onClick={handleVerifyStart}
                  >
                    Verify email
                  </button>
                </div>
                <div className="login-meta">
                  Need an account? Ask your admin for access.
                </div>
              </>
            )}
            {authStep === "forgot-request" && (
              <>
                <form className="login-form" onSubmit={handleForgotRequest}>
                  <label className="login-field">
                    <span>Email or username</span>
                    <input
                      type="text"
                      value={forgotIdentifier}
                      onChange={(event) => {
                        setForgotIdentifier(event.target.value);
                        if (forgotError) setForgotError("");
                        if (forgotNotice) setForgotNotice("");
                      }}
                      placeholder="name@hospital.org or dr_singh"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-accent btn-block"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? "Sending code..." : "Send code"}
                  </button>
                </form>
                <div className="login-links">
                  <button
                    type="button"
                    className="login-link"
                    onClick={handleForgotCancel}
                    disabled={forgotLoading}
                  >
                    Back to sign in
                  </button>
                </div>
              </>
            )}
            {authStep === "forgot-verify" && (
              <>
                <form className="login-form" onSubmit={handleForgotReset}>
                  <label className="login-field">
                    <span>Email or username</span>
                    <input
                      type="text"
                      value={forgotIdentifier}
                      onChange={(event) => {
                        setForgotIdentifier(event.target.value);
                        if (forgotError) setForgotError("");
                        if (forgotNotice) setForgotNotice("");
                      }}
                      placeholder="name@hospital.org or dr_singh"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="login-field">
                    <span>Verification code</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={forgotOtp}
                      onChange={(event) => {
                        setForgotOtp(event.target.value);
                        if (forgotError) setForgotError("");
                      }}
                      placeholder="6-digit code"
                      autoComplete="one-time-code"
                      required
                    />
                  </label>
                  <label className="login-field">
                    <span>New password</span>
                    <input
                      type="password"
                      value={forgotPassword}
                      onChange={(event) => {
                        setForgotPassword(event.target.value);
                        if (forgotError) setForgotError("");
                      }}
                      placeholder="Create a new password"
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  <label className="login-field">
                    <span>Confirm password</span>
                    <input
                      type="password"
                      value={forgotConfirm}
                      onChange={(event) => {
                        setForgotConfirm(event.target.value);
                        if (forgotError) setForgotError("");
                      }}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-accent btn-block"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? "Resetting..." : "Reset password"}
                  </button>
                </form>
                <div className="login-links">
                  <button
                    type="button"
                    className="login-link"
                    onClick={handleForgotResend}
                    disabled={forgotLoading}
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    className="login-link"
                    onClick={handleForgotCancel}
                    disabled={forgotLoading}
                  >
                    Back to sign in
                  </button>
                </div>
              </>
            )}
            {authStep === "verify-request" && (
              <>
                <form className="login-form" onSubmit={handleVerifyRequest}>
                  <label className="login-field">
                    <span>Email or username</span>
                    <input
                      type="text"
                      value={verifyIdentifier}
                      onChange={(event) => {
                        setVerifyIdentifier(event.target.value);
                        if (verifyError) setVerifyError("");
                        if (verifyNotice) setVerifyNotice("");
                      }}
                      placeholder="name@hospital.org or dr_singh"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-accent btn-block"
                    disabled={verifyLoading}
                  >
                    {verifyLoading ? "Sending code..." : "Send code"}
                  </button>
                </form>
                <div className="login-links">
                  <button
                    type="button"
                    className="login-link"
                    onClick={handleVerifyCancel}
                    disabled={verifyLoading}
                  >
                    Back to sign in
                  </button>
                </div>
              </>
            )}
            {authStep === "verify-confirm" && (
              <>
                <form className="login-form" onSubmit={handleVerifyConfirm}>
                  <label className="login-field">
                    <span>Email or username</span>
                    <input
                      type="text"
                      value={verifyIdentifier}
                      onChange={(event) => {
                        setVerifyIdentifier(event.target.value);
                        if (verifyError) setVerifyError("");
                        if (verifyNotice) setVerifyNotice("");
                      }}
                      placeholder="name@hospital.org or dr_singh"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="login-field">
                    <span>Verification code</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={verifyOtp}
                      onChange={(event) => {
                        setVerifyOtp(event.target.value);
                        if (verifyError) setVerifyError("");
                      }}
                      placeholder="6-digit code"
                      autoComplete="one-time-code"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-accent btn-block"
                    disabled={verifyLoading}
                  >
                    {verifyLoading ? "Verifying..." : "Verify email"}
                  </button>
                </form>
                <div className="login-links">
                  <button
                    type="button"
                    className="login-link"
                    onClick={handleVerifyResend}
                    disabled={verifyLoading}
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    className="login-link"
                    onClick={handleVerifyCancel}
                    disabled={verifyLoading}
                  >
                    Back to sign in
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isWorkspace) {
    return (
      <div className="workspace workspace-blender">
        <div className="ambient" aria-hidden="true" />
        <div className="workspace-topbar">
          <div className="workspace-brand">
            <span>Corpus Medica</span>
            <strong>Viewer Workspace</strong>
          </div>
          <div className="workspace-menu">
            <button type="button">File</button>
            <button type="button">Edit</button>
            <button type="button">View</button>
            <button type="button">Annotate</button>
            <button type="button">Render</button>
            <button type="button">Help</button>
          </div>
          <div className="workspace-top-actions">
            <div className="workspace-status">
              <span>{selectionLabel}</span>
              {selectionWarning && (
                <span className="warning">{selectionWarning}</span>
              )}
              {uploadPath && (
                <span className="meta-chip">Path: {uploadPath}</span>
              )}
            </div>
            {authUser && (
              <div className="workspace-user">
                <span className="role">{authRoleLabel}</span>
                <span className="name">{authDisplayName}</span>
                <button type="button" onClick={handleLogout}>
                  Sign out
                </button>
              </div>
            )}
            {enable3DViewer && (
              <div className="mode-toggle">
                <button
                  type="button"
                  className={viewerMode === "2d" ? "active" : ""}
                  onClick={() => setViewerMode("2d")}
                >
                  2D
                </button>
                <button
                  type="button"
                  className={viewerMode === "3d" ? "active" : ""}
                  onClick={() => setViewerMode("3d")}
                >
                  3D
                </button>
              </div>
            )}
            <div className="workspace-shelf-toggle">
              <button
                type="button"
                className={showLeftShelf ? "active" : ""}
                onClick={() => setShowLeftShelf((prev) => !prev)}
                aria-pressed={showLeftShelf}
              >
                {showLeftShelf ? "Hide left" : "Show left"}
              </button>
              <button
                type="button"
                className={showRightShelf ? "active" : ""}
                onClick={() => setShowRightShelf((prev) => !prev)}
                aria-pressed={showRightShelf}
              >
                {showRightShelf ? "Hide right" : "Show right"}
              </button>
            </div>
            <div className="workspace-upload">
              <label className="btn btn-secondary btn-small" htmlFor="workspace-upload">
                Choose files
              </label>
              <input
                id="workspace-upload"
                type="file"
                multiple
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="btn btn-accent btn-small"
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
              <a className="btn btn-ghost btn-small" href={backToWorkflowUrl}>
                Back
              </a>
            </div>
          </div>
        </div>

        <div className="workspace-shell">
          <main className="workspace-viewport">
            <div className="viewport-header">
              <div>
                <div className="viewport-title">Scan workspace</div>
                <div className="viewport-subtitle">
                  Toggle between 2D annotation and 3D exploration.
                </div>
              </div>
              {enable3DViewer && (
                <div className="viewer-tabs-row">
                  <div className="viewer-tabs">
                    <button
                      type="button"
                      className={`viewer-tab ${viewerMode === "2d" ? "active" : ""}`}
                      onClick={() => setViewerMode("2d")}
                    >
                      2D slices
                    </button>
                    <button
                      type="button"
                      className={`viewer-tab ${viewerMode === "3d" ? "active" : ""}`}
                      onClick={() => setViewerMode("3d")}
                    >
                      3D
                    </button>
                  </div>
                  {viewerMode === "3d" && (
                    <div className="viewer-subtabs">
                      <button
                        type="button"
                        className={`viewer-tab ${viewer3dMode === "volume" ? "active" : ""}`}
                        onClick={() => setViewer3dMode("volume")}
                      >
                        Volume
                      </button>
                      <button
                        type="button"
                        className={`viewer-tab ${viewer3dMode === "mesh" ? "active" : ""}`}
                        onClick={() => setViewer3dMode("mesh")}
                      >
                        Mesh
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {viewerError && (
              <div className="banner banner-error" role="alert">
                {viewerError}
              </div>
            )}

            <div
              className={`viewport-area ${
                viewerMode === "2d" ? "viewport-2d" : "viewport-3d"
              }`}
            >
              {!uploadPath && (
                <div className="viewer-empty">
                  Upload scans to start annotating.
                </div>
              )}

              {uploadPath && viewerMode === "2d" && (
                <>
                  {viewerLoading && (
                    <div className="viewer-loading skeleton">
                      <div className="skeleton-line wide" />
                      <div className="skeleton-line" />
                      <div className="skeleton-line short" />
                    </div>
                  )}
                  {!viewerLoading && volumeInfo && axisSizes && (
                    <div className="viewer-grid">
                      {(["sagittal", "coronal", "axial"] as AxisKey[]).map(
                        (axis) => (
                          <div className="viewer-panel" key={axis}>
                            <div className="viewer-panel-head">
                              <span className="viewer-label">{axis}</span>
                              <span className="viewer-index">
                                {sliceIndex[axis]} / {axisSizes[axis] - 1}
                              </span>
                            </div>
                            <div className="viewer-image viewer-image-annotated">
                              <img
                                ref={(node) => {
                                  imageRefs.current[axis] = node;
                                }}
                                src={buildSliceUrl(axis, sliceRequestIndex[axis])}
                                alt={`${axis} slice`}
                                loading="lazy"
                                decoding="async"
                                onLoad={() => renderOverlay(axis)}
                              />
                              <canvas
                                ref={(node) => {
                                  canvasRefs.current[axis] = node;
                                }}
                                data-axis={axis}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                onPointerLeave={handlePointerUp}
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
                        )
                      )}
                    </div>
                  )}
                  {viewerMode === "2d" && !viewerLoading && !volumeInfo && (
                    <p className="muted">Viewer not available for this upload.</p>
                  )}
                </>
              )}

              {uploadPath && viewerMode === "3d" && (
                <div className="viewer-3d">
                  <div className="viewer-3d-frame">
                    {viewer3dMode === "volume" && (
                      <div className="viewer-3d-canvas" ref={viewerRef} />
                    )}
                    {viewer3dMode === "mesh" && (
                      <div
                        className={`viewer-3d-canvas viewer-3d-mesh viewer-3d-mesh-${meshTool}`}
                        ref={meshViewerRef}
                      />
                    )}
                    {viewer3dMode === "volume" && viewer3dLoading && (
                      <div className="viewer-3d-loading">Loading volume...</div>
                    )}
                    {viewer3dMode === "mesh" && meshLoading && (
                      <div className="viewer-3d-loading">Building mesh...</div>
                    )}
                  </div>
                  {viewer3dMode === "volume" && viewer3dError && (
                    <div className="banner banner-error" role="alert">
                      {viewer3dError}
                    </div>
                  )}
                  {viewer3dMode === "mesh" && meshError && (
                    <div className="banner banner-error" role="alert">
                      {meshError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>

          {!showLeftShelf && (
            <button
              type="button"
              className="workspace-dock workspace-dock-left"
              onClick={() => setShowLeftShelf(true)}
            >
              Show left shelf
            </button>
          )}
          {!showRightShelf && (
            <button
              type="button"
              className="workspace-dock workspace-dock-right"
              onClick={() => setShowRightShelf(true)}
            >
              Show right shelf
            </button>
          )}

          {showLeftShelf && (
            <div
              className="workspace-float workspace-float-left"
              ref={leftPanelRef}
              style={{
                transform: `translate3d(${panelPositions.left.x}px, ${panelPositions.left.y}px, 0)`,
                width: panelSizes.left.width,
                height: panelSizes.left.height,
              }}
            >
              <div
                className="workspace-float-handle"
                onPointerDown={beginPanelDrag("left")}
              >
                Tool Shelf
              </div>
              <div className="workspace-float-content">
                {viewerMode === "2d" && (
                  <>
                    <div className="workspace-card">
                      <h3>Tools</h3>
                      <div className="tool-grid">
                        {WORKSPACE_TOOLS.map((tool) => (
                          <button
                            key={tool.id}
                            type="button"
                            className={`tool-button ${
                              workspaceTool === tool.id ? "active" : ""
                            }`}
                            onClick={() => setWorkspaceTool(tool.id)}
                          >
                            {tool.label}
                          </button>
                        ))}
                      </div>
                      <div className="workspace-control">
                        <label>
                          Brush size
                          <input
                            type="range"
                            min={4}
                            max={40}
                            value={brushSize}
                            onChange={(event) =>
                              setBrushSize(Number(event.target.value))
                            }
                          />
                        </label>
                        <strong>{brushSize}px</strong>
                      </div>
                      <div className="workspace-control">
                        <label>
                          Overlay opacity
                          <input
                            type="range"
                            min={0.2}
                            max={0.95}
                            step={0.05}
                            value={overlayOpacity}
                            onChange={(event) =>
                              setOverlayOpacity(Number(event.target.value))
                            }
                          />
                        </label>
                        <strong>{Math.round(overlayOpacity * 100)}%</strong>
                      </div>
                    </div>

                    <div className="workspace-card">
                      <h3>Actions</h3>
                      <div className="action-grid">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleUndo}
                        >
                          Undo
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleClearSlice}
                        >
                          Clear slice
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleClearAll}
                        >
                          Clear all
                        </button>
                        <button
                          type="button"
                          className="btn btn-accent"
                          onClick={handleExportAnnotations}
                        >
                          Export JSON
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {viewerMode === "3d" && viewer3dMode === "mesh" && (
                  <div className="workspace-card">
                    <h3>Mesh sculpt</h3>
                    <div className="tool-grid">
                      {([
                        { id: "orbit", label: "Orbit" },
                        { id: "select", label: "Select" },
                        { id: "sculpt", label: "Sculpt" },
                        { id: "carve", label: "Carve" },
                      ] as Array<{ id: MeshTool; label: string }>).map(
                        (tool) => (
                          <button
                            key={tool.id}
                            type="button"
                            className={`tool-button ${
                              meshTool === tool.id ? "active" : ""
                            }`}
                            onClick={() => setMeshTool(tool.id)}
                            disabled={
                              (tool.id === "sculpt" || tool.id === "carve") &&
                              !meshSculptEnabled
                            }
                          >
                            {tool.label}
                          </button>
                        )
                      )}
                    </div>
                    <div className="workspace-control">
                      <label>
                        Brush radius
                        <input
                          type="range"
                          min={4}
                          max={48}
                          value={meshBrushSize}
                          onChange={(event) =>
                            setMeshBrushSize(Number(event.target.value))
                          }
                          disabled={!meshSculptEnabled || meshTool === "select"}
                        />
                      </label>
                      <strong>{meshBrushSize}px</strong>
                    </div>
                    <div className="workspace-control">
                      <label>
                        Strength
                        <input
                          type="range"
                          min={0.1}
                          max={1}
                          step={0.05}
                          value={meshStrength}
                          onChange={(event) =>
                            setMeshStrength(Number(event.target.value))
                          }
                          disabled={!meshSculptEnabled || meshTool === "select"}
                        />
                      </label>
                      <strong>{Math.round(meshStrength * 100)}%</strong>
                    </div>
                    <div className="mesh-selection">
                      <div className="mesh-selection-head">
                        <span>Selection</span>
                        <span className="mesh-selection-count">
                          {meshSelectionCount} voxels
                        </span>
                      </div>
                      <div className="workspace-control">
                        <label>
                          Pick radius
                          <input
                            type="range"
                            min={0.5}
                            max={12}
                            step={0.5}
                            value={meshSelectionRadius}
                            onChange={(event) =>
                              setMeshSelectionRadius(Number(event.target.value))
                            }
                            disabled={meshTool !== "select"}
                          />
                        </label>
                        <strong>{meshSelectionRadius.toFixed(1)}%</strong>
                      </div>
                      <div className="workspace-control">
                        <label>
                          Nudge strength
                          <input
                            type="range"
                            min={0.2}
                            max={1}
                            step={0.05}
                            value={meshSelectionStrength}
                            onChange={(event) =>
                              setMeshSelectionStrength(Number(event.target.value))
                            }
                            disabled={meshTool !== "select"}
                          />
                          </label>
                        <strong>{Math.round(meshSelectionStrength * 100)}%</strong>
                      </div>
                      <label className="mesh-selection-toggle">
                        <input
                          type="checkbox"
                          checked={meshSelectionPrecision}
                          onChange={(event) =>
                            setMeshSelectionPrecision(event.target.checked)
                          }
                          disabled={meshTool !== "select"}
                        />
                        <span>Precision pick (slower)</span>
                      </label>
                      {meshSelectionPrecision && meshVertexCount > 180000 && (
                        <div className="mesh-selection-note">
                          Precision pick can lag on dense meshes.
                        </div>
                      )}
                      <div className="mesh-selection-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => nudgeMeshSelection(1)}
                          disabled={!meshSelectionCount}
                        >
                          Nudge +
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => nudgeMeshSelection(-1)}
                          disabled={!meshSelectionCount}
                        >
                          Nudge -
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={clearMeshSelection}
                          disabled={!meshSelectionCount}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    {meshExplodeEnabled && (
                      <div className="mesh-warning mesh-warning-accent">
                        Explode view is active. Sculpting is disabled, but selection
                        and isolate controls still work.
                      </div>
                    )}
                    {!meshCanSculpt && !meshExplodeEnabled && (
                      <div className="mesh-warning">
                        Sculpting is disabled for dense meshes. Increase the
                        mesh step or reduce the iso complexity, or use Select
                        to isolate and nudge.
                      </div>
                    )}
                  </div>
                )}

                {viewerMode === "3d" && viewer3dMode === "volume" && (
                  <div className="workspace-card">
                    <h3>3D navigation</h3>
                    <p className="muted">
                      Drag to rotate, scroll to zoom, right-click to pan.
                    </p>
                  </div>
                )}
              </div>
              <div
                className="panel-resizer panel-resizer-nw"
                onPointerDown={beginPanelResize("left", "nw")}
              />
              <div
                className="panel-resizer panel-resizer-ne"
                onPointerDown={beginPanelResize("left", "ne")}
              />
              <div
                className="panel-resizer panel-resizer-sw"
                onPointerDown={beginPanelResize("left", "sw")}
              />
              <div
                className="panel-resizer panel-resizer-se"
                onPointerDown={beginPanelResize("left", "se")}
              />
            </div>
          )}

          {showRightShelf && (
            <div
              className="workspace-float workspace-float-right"
              ref={rightPanelRef}
              style={{
                transform: `translate3d(${panelPositions.right.x}px, ${panelPositions.right.y}px, 0)`,
                width: panelSizes.right.width,
                height: panelSizes.right.height,
              }}
            >
              <div
                className="workspace-float-handle"
                onPointerDown={beginPanelDrag("right")}
              >
                Properties
              </div>
              <div className="workspace-float-content">
                {enable3DViewer && (
                  <div className="workspace-card">
                    <h3>View mode</h3>
                    <div className="mode-toggle">
                      <button
                        type="button"
                        className={viewerMode === "2d" ? "active" : ""}
                        onClick={() => setViewerMode("2d")}
                      >
                        2D slices
                      </button>
                      <button
                        type="button"
                        className={viewerMode === "3d" ? "active" : ""}
                        onClick={() => setViewerMode("3d")}
                      >
                        3D
                      </button>
                    </div>
                    {viewerMode === "3d" && (
                      <div className="viewer-subtabs">
                        <button
                          type="button"
                          className={`viewer-tab ${viewer3dMode === "volume" ? "active" : ""}`}
                          onClick={() => setViewer3dMode("volume")}
                        >
                          Volume
                        </button>
                        <button
                          type="button"
                          className={`viewer-tab ${viewer3dMode === "mesh" ? "active" : ""}`}
                          onClick={() => setViewer3dMode("mesh")}
                        >
                          Mesh
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="workspace-card">
                  <h3>Viewport settings</h3>
                  {viewerMode === "2d" && (
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
                    </>
                  )}

                  {viewerMode === "3d" && viewer3dMode === "volume" && (
                    <>
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
                        <label className="viewer-control">
                          <span>Opacity</span>
                          <input
                            type="range"
                            min={0.2}
                            max={1}
                            step={0.05}
                            value={volumeOpacity}
                            onChange={(event) =>
                              setVolumeOpacity(Number(event.target.value))
                            }
                          />
                        </label>
                        <label className="viewer-control">
                          <span>Clipping</span>
                          <div className="clip-toggle">
                            <input
                              type="checkbox"
                              checked={clipEnabled}
                              onChange={(event) =>
                                setClipEnabled(event.target.checked)
                              }
                            />
                            <select
                              value={clipAxis}
                              onChange={(event) =>
                                setClipAxis(event.target.value as ClipAxis)
                              }
                              disabled={!clipEnabled}
                            >
                              <option value="x">X</option>
                              <option value="y">Y</option>
                              <option value="z">Z</option>
                            </select>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={clipValue}
                            onChange={(event) =>
                              setClipValue(Number(event.target.value))
                            }
                            disabled={!clipEnabled}
                          />
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
                    </>
                  )}

                  {viewerMode === "3d" && viewer3dMode === "mesh" && (
                    <>
                      <div className="viewer-controls viewer-controls-stack">
                        <label className="viewer-control">
                          <span>Iso threshold</span>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={meshIso}
                            onChange={(event) =>
                              setMeshIso(Number(event.target.value))
                            }
                          />
                          <span className="viewer-control-value">
                            {meshIso.toFixed(2)}
                          </span>
                        </label>
                        <label className="viewer-control">
                          <span>Mesh step</span>
                          <input
                            type="range"
                            min={1}
                            max={6}
                            step={1}
                            value={meshStep}
                            onChange={(event) =>
                              setMeshStep(Number(event.target.value))
                            }
                          />
                          <span className="viewer-control-value">
                            {meshStep}
                          </span>
                        </label>
                        <label className="viewer-control">
                          <span>Mesh source</span>
                          <select
                            value={meshSource}
                            onChange={(event) =>
                              setMeshSource(event.target.value as MeshSource)
                            }
                          >
                            <option value="scan">Scan intensity</option>
                            <option value="mask" disabled={!meshMaskAvailable}>
                              Segmentation mask
                            </option>
                          </select>
                          {!meshMaskAvailable && (
                            <span className="viewer-control-note">
                              Run a segmentation to enable mask meshes.
                            </span>
                          )}
                        </label>
                        <label className="viewer-control">
                          <span>Tumor overlay</span>
                          <div className="clip-toggle">
                            <input
                              type="checkbox"
                              checked={meshOverlayEnabled}
                              onChange={(event) =>
                                setMeshOverlayEnabled(event.target.checked)
                              }
                              disabled={!meshMaskAvailable || meshSource === "mask"}
                            />
                            <span className="viewer-control-value">
                              {meshOverlayEnabled &&
                              meshMaskAvailable &&
                              meshSource !== "mask"
                                ? "On"
                                : "Off"}
                            </span>
                          </div>
                          {meshSource === "mask" && (
                            <span className="viewer-control-note">
                              Overlay uses the mask. Switch source to Scan to
                              see both.
                            </span>
                          )}
                        </label>
                        {meshOverlayEnabled &&
                          meshMaskAvailable &&
                          meshSource !== "mask" && (
                            <>
                              <label className="viewer-control">
                                <span>Tumor opacity</span>
                                <input
                                  type="range"
                                  min={0.15}
                                  max={0.9}
                                  step={0.05}
                                  value={meshOverlayOpacity}
                                  onChange={(event) =>
                                    setMeshOverlayOpacity(
                                      Number(event.target.value)
                                    )
                                  }
                                />
                                <span className="viewer-control-value">
                                  {Math.round(meshOverlayOpacity * 100)}%
                                </span>
                              </label>
                              <label className="viewer-control">
                                <span>Mask iso</span>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  value={meshOverlayIso}
                                  onChange={(event) =>
                                    setMeshOverlayIso(Number(event.target.value))
                                  }
                                />
                                <span className="viewer-control-value">
                                  {meshOverlayIso.toFixed(2)}
                                </span>
                              </label>
                              <label className="viewer-control">
                                <span>Mask step</span>
                                <input
                                  type="range"
                                  min={1}
                                  max={4}
                                  step={1}
                                  value={meshOverlayStep}
                                  onChange={(event) =>
                                    setMeshOverlayStep(Number(event.target.value))
                                  }
                                />
                                <span className="viewer-control-value">
                                  {meshOverlayStep}
                                </span>
                              </label>
                            </>
                          )}
                        <label className="viewer-control">
                          <span>Group count</span>
                          <input
                            type="range"
                            min={1}
                            max={MAX_MESH_PARTS}
                            step={1}
                            value={meshGroupCount}
                            onChange={(event) =>
                              setMeshGroupCount(Number(event.target.value))
                            }
                          />
                          <span className="viewer-control-value">
                            {meshGroupCount}
                          </span>
                        </label>
                        <label className="viewer-control">
                          <span>Material preset</span>
                          <select
                            value={meshMaterialPreset}
                            onChange={(event) =>
                              setMeshMaterialPreset(
                                event.target.value as MeshMaterialPreset
                              )
                            }
                          >
                            {Object.entries(MESH_MATERIAL_PRESETS).map(
                              ([id, preset]) => (
                                <option key={id} value={id}>
                                  {preset.label}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                        <label className="viewer-control">
                          <span>Wireframe</span>
                          <input
                            type="checkbox"
                            checked={meshWireframe}
                            onChange={(event) =>
                              setMeshWireframe(event.target.checked)
                            }
                          />
                        </label>
                        <label className="viewer-control">
                          <span>Clipping</span>
                          <div className="clip-toggle">
                            <input
                              type="checkbox"
                              checked={meshClipEnabled}
                              onChange={(event) =>
                                setMeshClipEnabled(event.target.checked)
                              }
                            />
                            <select
                              value={meshClipAxis}
                              onChange={(event) =>
                                setMeshClipAxis(event.target.value as ClipAxis)
                              }
                              disabled={!meshClipEnabled}
                            >
                              <option value="x">X</option>
                              <option value="y">Y</option>
                              <option value="z">Z</option>
                            </select>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={meshClipValue}
                            onChange={(event) =>
                              setMeshClipValue(Number(event.target.value))
                            }
                            disabled={!meshClipEnabled}
                          />
                        </label>
                        <div className="mesh-explode">
                          <div className="mesh-explode-head">
                            <span>Explode view</span>
                            <label className="mesh-explode-toggle">
                              <input
                                type="checkbox"
                                checked={meshExplodeEnabled}
                                onChange={(event) =>
                                  setMeshExplodeEnabled(event.target.checked)
                                }
                              />
                              <span>
                                {meshExplodeEnabled ? "Active" : "Off"}
                              </span>
                            </label>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.02}
                            value={meshExplodeDistance}
                            onChange={(event) =>
                              setMeshExplodeDistance(Number(event.target.value))
                            }
                            disabled={!meshExplodeEnabled}
                          />
                          <div className="mesh-explode-meta">
                            <span>Separation</span>
                            <strong>
                              {Math.round(meshExplodeDistance * 100)}%
                            </strong>
                          </div>
                        </div>
                        <div className="mesh-isolate">
                          <div className="mesh-isolate-head">
                            <span>Isolate part</span>
                            <label className="mesh-explode-toggle">
                              <input
                                type="checkbox"
                                checked={meshIsolateEnabled}
                                onChange={(event) =>
                                  setMeshIsolateEnabled(event.target.checked)
                                }
                                disabled={meshPartCount <= 1}
                              />
                              <span>
                                {meshIsolateEnabled ? "On" : "Off"}
                              </span>
                            </label>
                          </div>
                          <div className="mesh-isolate-controls">
                            <button
                              type="button"
                              className="btn btn-ghost btn-small"
                              onClick={() => stepMeshActiveGroup(-1)}
                              disabled={meshPartCount <= 1}
                            >
                              Prev
                            </button>
                            <span className="mesh-isolate-count">
                              {meshPartCount ? meshActiveGroup + 1 : 0} /{" "}
                              {meshPartCount || 1}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-small"
                              onClick={() => stepMeshActiveGroup(1)}
                              disabled={meshPartCount <= 1}
                            >
                              Next
                            </button>
                          </div>
                          <div className="mesh-isolate-offset">
                            <label>
                              Active offset
                              <input
                                type="range"
                                min={-1}
                                max={1}
                                step={0.05}
                                value={activePartOffset}
                                onChange={(event) =>
                                  updateActivePartOffset(
                                    Number(event.target.value)
                                  )
                                }
                                disabled={!meshPartCount}
                              />
                            </label>
                            <strong>
                              {Math.round(activePartOffset * 100)}%
                            </strong>
                            <button
                              type="button"
                              className="btn btn-ghost btn-small"
                              onClick={resetPartOffsets}
                              disabled={!hasPartOffsets}
                            >
                              Reset
                            </button>
                          </div>
                        </div>
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
                      <div className="mesh-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={requestMeshRebuild}
                        >
                          Rebuild mesh
                        </button>
                        <div className="mesh-meta">
                          <span>Vertices</span>
                          <strong>{meshVertexCount.toLocaleString()}</strong>
                        </div>
                        <div className="mesh-meta">
                          <span>Parts</span>
                          <strong>{meshPartCount || 1}</strong>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="workspace-card">
                  <div className="workspace-card-head">
                    <h3>Labels</h3>
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={handleAddLabel}
                    >
                      Add
                    </button>
                  </div>
                  <div className="label-list">
                    {labels.map((label) => (
                      <div
                        key={label.id}
                        className={`label-item ${
                          activeLabelId === label.id ? "active" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="label-select"
                          onClick={() => setActiveLabelId(label.id)}
                        >
                          <span
                            className="label-swatch"
                            style={{ backgroundColor: label.color }}
                          />
                        </button>
                        <input
                          type="text"
                          value={label.name}
                          onChange={(event) =>
                            handleLabelUpdate(label.id, { name: event.target.value })
                          }
                        />
                        <input
                          type="color"
                          value={label.color}
                          onChange={(event) =>
                            handleLabelUpdate(label.id, { color: event.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="label-remove"
                          onClick={() => handleRemoveLabel(label.id)}
                          disabled={labels.length <= 1}
                        >
                          ?
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="workspace-card">
                  <h3>Scan info</h3>
                  {volumeInfo ? (
                    <div className="meta-list">
                      <div>Shape: {volumeInfo.shape.join(" x ")}</div>
                      <div>Channels: {volumeInfo.channels}</div>
                      {volumeInfo.zooms && (
                        <div>Voxel size: {volumeInfo.zooms.join(" x ")}</div>
                      )}
                    </div>
                  ) : (
                    <p className="muted">Upload a scan to see metadata.</p>
                  )}
                </div>

                <div className="workspace-card">
                  <h3>Annotation summary</h3>
                  <div className="meta-list">
                    <div>Active slice: {activeSliceCount}</div>
                    <div>Total annotations: {annotationSummary.total}</div>
                    <div>Brush strokes: {annotationSummary.strokes}</div>
                    <div>Rectangles: {annotationSummary.rects}</div>
                    <div>Measurements: {annotationSummary.measures}</div>
                  </div>
                </div>
              </div>
              <div
                className="panel-resizer panel-resizer-nw"
                onPointerDown={beginPanelResize("right", "nw")}
              />
              <div
                className="panel-resizer panel-resizer-ne"
                onPointerDown={beginPanelResize("right", "ne")}
              />
              <div
                className="panel-resizer panel-resizer-sw"
                onPointerDown={beginPanelResize("right", "sw")}
              />
              <div
                className="panel-resizer panel-resizer-se"
                onPointerDown={beginPanelResize("right", "se")}
              />
            </div>
          )}
        </div>

        <div className="workspace-bottombar">
          <span>
            Tool: {workspaceTool} | Label: {labelMap.get(activeLabelId)?.name ?? "None"}
          </span>
          <span className="workspace-hint">
            {viewerMode === "3d"
              ? viewer3dMode === "mesh"
                ? meshHint
                : "Drag to rotate, scroll to zoom, right-click to pan."
              : "Use brush/erase to paint, drag to create ROIs, click-drag to measure."}
          </span>
          {volumeInfo && (
            <span>
              Slice {sliceIndex[activeAxis] + 1} / {axisSizes?.[activeAxis] ?? 1}
            </span>
          )}
        </div>

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

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true" />
      <div className="topbar">
        <div className="topbar-brand">
          <span>Corpus Medica</span>
          <span className="topbar-tag">Medical AI workspace</span>
        </div>
        {authUser && (
          <div className="topbar-actions">
            <div className="auth-chip">
              <span className="role">{authRoleLabel}</span>
              <span className="name">{authDisplayName}</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
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
                {enableViewerWorkspace && uploadPath && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={openWorkspace}
                  >
                    Open workspace
                  </button>
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
                          src={buildSliceUrl(axis, sliceRequestIndex[axis])}
                          alt={`${axis} slice`}
                          loading="lazy"
                          decoding="async"
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

      <section className="panel report-panel">
        <div className="panel-head">
          <div>
            <h2>5. Report analysis</h2>
            <p>Upload lab reports to extract values and generate insights.</p>
          </div>
          <span
            className={`status-badge ${
              reportResult ? "status-done" : reportLoading ? "status-running" : ""
            }`}
          >
            {reportLoading
              ? "Analyzing"
              : reportResult
              ? "Complete"
              : "Awaiting report"}
          </span>
        </div>

        {reportError && (
          <div className="banner banner-error" role="alert">
            {reportError}
          </div>
        )}
        {reportNotice && (
          <div className="banner banner-info" role="status">
            {reportNotice}
          </div>
        )}

        <div className="report-flow">
          <div className={`report-step ${reportFile ? "is-done" : ""}`}>
            <div className="report-step-title">Upload</div>
            <div className="report-step-subtitle">
              {reportFile ? "File ready" : "Choose file"}
            </div>
          </div>
          <div
            className={`report-step ${
              reportLoading ? "is-active" : reportResult ? "is-done" : ""
            }`}
          >
            <div className="report-step-title">Extract</div>
            <div className="report-step-subtitle">
              {reportLoading ? "Parsing" : reportResult ? "Complete" : "Waiting"}
            </div>
          </div>
          <div className={`report-step ${reportResult ? "is-done" : ""}`}>
            <div className="report-step-title">Assess</div>
            <div className="report-step-subtitle">
              {reportResult ? "Risk mapped" : "Pending"}
            </div>
          </div>
          <div className={`report-step ${reportResult ? "is-done" : ""}`}>
            <div className="report-step-title">Explain</div>
            <div className="report-step-subtitle">
              {reportResult ? "Narrative ready" : "Pending"}
            </div>
          </div>
        </div>

        {reportResult && (
          <div className="report-summary">
            <div className={`report-summary-card ${reportRiskClass}`}>
              <span>Risk level</span>
              <strong>{reportRiskLevel}</strong>
            </div>
            <div className="report-summary-card">
              <span>Values extracted</span>
              <strong>{reportStats.valueCount}</strong>
            </div>
            <div className="report-summary-card">
              <span>Abnormalities</span>
              <strong>{reportStats.abnormalCount}</strong>
            </div>
            <div className="report-summary-card">
              <span>Possible symptoms</span>
              <strong>{reportStats.symptomCount}</strong>
            </div>
          </div>
        )}

        <div className="report-grid">
          <div className="report-column">
            <div className="report-card report-card-upload">
              <h3>Upload report</h3>
              <p className="muted">
                Accepts PDF, JPG, PNG, or TXT lab reports.
              </p>
              <div className="report-upload">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                  onChange={handleReportFileChange}
                />
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={handleAnalyzeReport}
                  disabled={!reportFile || reportLoading}
                >
                  {reportLoading ? "Analyzing..." : "Analyze report"}
                </button>
              </div>
              {reportFile && (
                <div className="report-file">
                  Selected: <span className="mono">{reportFile.name}</span>
                </div>
              )}
            </div>

            <div className="report-card report-card-values">
              <div className="report-card-head">
                <div>
                  <h3>Extracted values</h3>
                  {reportResult && (
                    <p className="muted report-card-subtitle">
                      Showing {reportFilteredValues.length} of{" "}
                      {reportValues.length} values
                    </p>
                  )}
                </div>
                <div className="report-card-tools">
                  <input
                    type="search"
                    className="report-search"
                    placeholder="Search markers"
                    value={reportValueQuery}
                    onChange={(event) =>
                      setReportValueQuery(event.target.value)
                    }
                    disabled={!reportResult || reportLoading}
                  />
                  <button
                    type="button"
                    className={`btn btn-ghost btn-small report-filter-btn ${
                      reportOnlyAbnormal ? "is-active" : ""
                    }`}
                    onClick={() => setReportOnlyAbnormal((prev) => !prev)}
                    aria-pressed={reportOnlyAbnormal}
                    disabled={!reportResult || reportLoading}
                  >
                    Abnormal only
                  </button>
                </div>
              </div>
              {reportLoading && (
                <div className="skeleton-block">
                  <div className="skeleton-line wide" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line short" />
                </div>
              )}
              {!reportLoading && reportResult && reportValues.length > 0 && (
                <div className="report-table">
                  <div className="report-table-head">
                    <span>Marker</span>
                    <span>Value</span>
                    <span>Status</span>
                  </div>
                  {reportFilteredValues.map(([key, value]) => {
                    const abnormal = reportAbnormalityMap.has(key);
                    const note = reportAbnormalityMap.get(key);
                    return (
                      <div
                        key={key}
                        className={`report-table-row ${
                          abnormal ? "is-abnormal" : ""
                        }`}
                      >
                        <div className="report-table-key">{key}</div>
                        <div className="report-table-value">
                          {String(value)}
                        </div>
                        <div className="report-table-flag">
                          {abnormal ? (
                            <span className="report-flag report-flag-abnormal">
                              {note || "Abnormal"}
                            </span>
                          ) : (
                            <span className="report-flag report-flag-normal">
                              Normal
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!reportLoading &&
                reportResult &&
                reportValues.length > 0 &&
                reportFilteredValues.length === 0 && (
                  <p className="muted">
                    No values match the current filter.
                  </p>
                )}
              {!reportLoading && reportResult && reportValues.length === 0 && (
                <p className="muted">No structured values detected.</p>
              )}
              {!reportLoading && !reportResult && (
                <p className="muted">
                  Upload a report to see extracted values.
                </p>
              )}
            </div>
          </div>

          <div className="report-column">
            <div className="report-card report-card-risk">
              <h3>Risk summary</h3>
              {reportResult ? (
                <>
                  <div className="report-highlights">
                    <span className={`report-pill ${reportRiskClass}`}>
                      Risk: {reportResult.risk_analysis.risk_level}
                    </span>
                    <span
                      className={`report-pill ${
                        reportStats.abnormalCount
                          ? "report-pill-alert"
                          : "report-pill-soft"
                      }`}
                    >
                      {reportStats.abnormalCount} abnormalities
                    </span>
                    <span className="report-pill report-pill-soft">
                      {reportStats.symptomCount} symptoms
                    </span>
                  </div>
                  {reportAbnormalities.length > 0 ? (
                    <div className="report-group">
                      <strong>Abnormalities</strong>
                      <div className="report-pill-grid">
                        {reportAbnormalities.map(([key, value]) => (
                          <span key={key} className="report-pill report-pill-alert">
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="muted">No abnormalities detected.</p>
                  )}
                  {reportResult.risk_analysis.explanations.length > 0 && (
                    <div className="report-group">
                      <strong>Notes</strong>
                      <div className="report-callout-stack">
                        {reportResult.risk_analysis.explanations.map((item) => (
                          <p key={item} className="report-callout">
                            {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {reportResult.risk_analysis.possible_symptoms.length > 0 && (
                    <div className="report-group">
                      <strong>Possible symptoms</strong>
                      <div className="report-pill-grid">
                        {reportResult.risk_analysis.possible_symptoms.map(
                          (item) => (
                            <span key={item} className="report-pill report-pill-soft">
                              {item}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
                  {reportResult.risk_analysis.disclaimer && (
                    <p className="report-callout report-callout-muted">
                      {reportResult.risk_analysis.disclaimer}
                    </p>
                  )}
                </>
              ) : (
                <p className="muted">
                  Upload a report to see risk assessment details.
                </p>
              )}
            </div>

            <div className="report-card report-card-wide">
              <h3>Groq explanation</h3>
              {reportLoading && (
                <div className="skeleton-block">
                  <div className="skeleton-line wide" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line short" />
                </div>
              )}
              {!reportLoading && reportResult && (
                <div className="report-explanation-block">
                  <p className="report-explanation">
                    {reportResult.llm_explanation}
                  </p>
                </div>
              )}
              {!reportLoading && !reportResult && (
                <p className="muted">
                  Groq explanations appear after a successful analysis.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="panel history-panel">
        <div className="panel-head">
          <div>
            <h2>6. Recent jobs</h2>
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

      {/* Floating Chat Button */}
      <button
        onClick={() => setChatPanelOpen(true)}
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s',
          zIndex: 999,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 30px rgba(102, 126, 234, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.5)';
        }}
        title="Ask AI Assistant"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Chat Panel */}
      <ChatPanel
        isOpen={chatPanelOpen}
        onClose={() => setChatPanelOpen(false)}
        apiBase={API_BASE}
      />
    </div>
  );
}
