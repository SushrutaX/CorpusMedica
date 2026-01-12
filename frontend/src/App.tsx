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

const buildDownloadUrl = (path: string) =>
  `${API_BASE}/api/download?path=${encodeURIComponent(path)}`;

const SKELETONS = Array.from({ length: 3 }, (_, index) => index);
const enable3DViewer =
  ((import.meta.env.VITE_ENABLE_3D_VIEWER as string) ?? "true") === "true";
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

  useEffect(() => {
    if (AUTH_REQUIRED && !isAuthenticated) return;
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
    uploadPath,
    viewerChannel,
    buildVolumeFileUrl,
    apiFetch,
    isAuthenticated,
  ]);

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
                    3D volume
                  </button>
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
                    <div className="viewer-3d-canvas" ref={viewerRef} />
                    {viewer3dLoading && (
                      <div className="viewer-3d-loading">Loading volume...</div>
                    )}
                  </div>
                  {viewer3dError && (
                    <div className="banner banner-error" role="alert">
                      {viewer3dError}
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
                    <button type="button" className="btn btn-secondary" onClick={handleUndo}>
                      Undo
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={handleClearSlice}>
                      Clear slice
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={handleClearAll}>
                      Clear all
                    </button>
                    <button type="button" className="btn btn-accent" onClick={handleExportAnnotations}>
                      Export JSON
                    </button>
                  </div>
                </div>
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
                        3D volume
                      </button>
                    </div>
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

                  {viewerMode === "3d" && (
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
              ? "Drag to rotate, scroll to zoom, right-click to pan."
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
