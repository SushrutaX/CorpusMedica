import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  DragEvent as ReactDragEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import anime from "animejs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import ChatPanel from "./components/ChatPanel";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import DocsPage from "./pages/DocsPage";
import FemaleAnatomyPage from "./pages/FemaleAnatomyPage";
import ReportAnalysis from "./pages/ReportAnalysis";
import DevPage from "./pages/DevPage";
import WorkspacePage from "./pages/WorkspacePage";

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

type WorkspaceUploadItem = {
  path: string;
  label: string;
  kind: string;
  createdAt: string;
  visible: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
};

type WorkspaceUploadCacheItem = Pick<
  WorkspaceUploadItem,
  "path" | "label" | "kind" | "createdAt" | "visible" | "position" | "rotation"
>;

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
type Viewer3DMode = "volume" | "mesh";
type MeshTool = "orbit" | "sculpt" | "carve" | "select" | "label";
type MeshMaterialPreset =
  | "brain"
  | "bone"
  | "vessel"
  | "skin"
  | "muscle"
  | "glass";
type MeshSource = "scan" | "mask";
type MeshAnatomyPreset = "brain" | "breast" | "abdomen" | "generic";

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

type OverlayMaterialPreset = "brain" | "bone" | "muscle" | "vessel";
type OverlayLayer = "overlay" | "underlay";

type MeshOverlayItem = {
  id: string;
  path: string;
  label: string;
  materialPreset: OverlayMaterialPreset;
  opacity: number;
  visible: boolean;
  renderMode: "volume" | "mesh";
  layer: OverlayLayer;
  position?: [number, number, number];
  rotation?: [number, number, number];
  clipEnabled?: boolean;
  clipAxis?: ClipAxis;
  clipValue?: number;
  explodeEnabled?: boolean;
  explodeDistance?: number;
};

type MeshOverlayCacheItem = {
  id: string;
  path: string;
  label: string;
  materialPreset: OverlayMaterialPreset;
  opacity: number;
  visible: boolean;
  renderMode: "volume" | "mesh";
  position?: [number, number, number];
  rotation?: [number, number, number];
  clipEnabled?: boolean;
  clipAxis?: ClipAxis;
  clipValue?: number;
  explodeEnabled?: boolean;
  explodeDistance?: number;
};

type WorkspaceSettingsCache = {
  viewerMode?: ViewerMode;
  viewer3dMode?: Viewer3DMode;
  sliceColormap?: SliceColorMap;
  volumeColormap?: VolumeColorMap;
  volumeOpacity?: number;
  clipEnabled?: boolean;
  clipAxis?: ClipAxis;
  clipValue?: number;
  meshTool?: MeshTool;
  meshIso?: number;
  meshStep?: number;
  meshSource?: MeshSource;
  meshOpacity?: number;
  meshVolumeEnabled?: boolean;
  meshVolumeOpacity?: number;
  meshVolumeColormap?: VolumeColorMap;
  meshVesselEnabled?: boolean;
  meshVesselThreshold?: number;
  meshVesselSigmaMin?: number;
  meshVesselSigmaMax?: number;
  meshVesselStep?: number;
  meshOverlayEnabled?: boolean;
  meshOverlayOpacity?: number;
  meshOverlayIso?: number;
  meshOverlayStep?: number;
  meshOverlayLockEnabled?: boolean;
  meshOverlayLockTarget?: string;
  meshWireframe?: boolean;
  meshClipEnabled?: boolean;
  meshClipAxis?: ClipAxis;
  meshClipValue?: number;
  meshExplodeEnabled?: boolean;
  meshExplodeDistance?: number;
  meshMaterialPreset?: MeshMaterialPreset;
  meshGroupCount?: number;
  meshSelectionRadius?: number;
  meshSelectionStrength?: number;
  meshSelectionPrecision?: boolean;
  meshLabelEnabled?: boolean;
  meshAnatomyEnabled?: boolean;
  meshAnatomyPreset?: MeshAnatomyPreset;
  meshSignalEnabled?: boolean;
  meshSignalSpeed?: number;
  meshSignalTargetId?: string;
  overlayOpacity?: number;
  workspaceTool?: WorkspaceTool;
  brushSize?: number;
};

type MeshOverlayVolume = {
  id: string;
  path: string;
  volume: any;
  mapper: any;
  ctfun: any;
  ofun: any;
  dataRange: [number, number];
  dimensions: [number, number, number];
  spacing: [number, number, number];
  origin?: [number, number, number];
  materialPreset: OverlayMaterialPreset;
  opacity: number;
  visible: boolean;
  layer: OverlayLayer;
  position?: [number, number, number];
  rotation?: [number, number, number];
  clipEnabled?: boolean;
  clipAxis?: ClipAxis;
  clipValue?: number;
  clipPlane?: any | null;
  explodeEnabled?: boolean;
  explodeDistance?: number;
};

type OverviewCache = {
  uploadResult?: UploadResponse;
  uploadPreview?: UploadPreview;
  previewPath?: string;
  volumeInfo?: VolumeInfo;
  sliceIndex?: SliceIndex;
  sliceRequestIndex?: SliceIndex;
  viewerChannel?: number;
  viewerMode?: ViewerMode;
  viewer3dMode?: Viewer3DMode;
  sliceColormap?: SliceColorMap;
  volumeColormap?: VolumeColorMap;
  volumeOpacity?: number;
  clipEnabled?: boolean;
  clipAxis?: ClipAxis;
  clipValue?: number;
  selectedModelId?: string;
};

type MeshViewerState = {
  three: any;
  plyLoader?: new () => {
    parse: (data: ArrayBuffer) => any;
  };
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
  overlayStackGroup?: any;
  overlayStackMeshes?: Map<
    string,
    {
      mesh: any;
      material: any;
      path: string;
      materialPreset: OverlayMaterialPreset;
      opacity: number;
      visible: boolean;
      iso: number;
      step: number;
      channel: number;
      layer: OverlayLayer;
      position?: [number, number, number];
      rotation?: [number, number, number];
      direction?: [number, number, number];
      clipEnabled?: boolean;
      clipAxis?: ClipAxis;
      clipValue?: number;
      explodeEnabled?: boolean;
      explodeDistance?: number;
    }
  >;
  labelGroup?: any;
  labelLine?: any;
  labelSprite?: any;
  labelPartIndex?: number;
  clipPlane: any | null;
  bounds: MeshBounds;
  centerOffset: [number, number, number];
  maxDim: number;
  activePartIndex: number;
  selection?: MeshSelection;
  signalState?: {
    material: any;
    uniforms: {
      uTime: { value: number };
      uSpeed: { value: number };
      uColor: { value: any };
      uOpacity: { value: number };
      uAxis: { value: any };
    };
    overlays: any[];
    targetId: string;
  };
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
  overlayVolumes?: Map<string, MeshOverlayVolume>;
  overlayLoader?: (item: MeshOverlayItem) => Promise<MeshOverlayVolume>;
};

const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";
const AUTH_BASE: string =
  (import.meta.env.VITE_AUTH_BASE_URL as string) || "http://localhost:9000";
const Z_ANATOMY_URL: string =
  (import.meta.env.VITE_Z_ANATOMY_URL as string) || "http://localhost:5174";
const LOGIN_MODEL_URL: string =
  (import.meta.env.VITE_LOGIN_MODEL_URL as string) || "/models/myology.glb";
const AUTH_REQUIRED =
  ((import.meta.env.VITE_AUTH_REQUIRED as string) ?? "false") === "true";
const AUTH_TOKEN_KEY = "medai_auth_token";
const AUTH_REFRESH_KEY = "medai_auth_refresh";
const WORKSPACE_UPLOADS_CACHE_KEY = "medai_workspace_uploads_v1";
const MESH_OVERLAY_CACHE_KEY = "medai_mesh_overlay_v1";
const WORKSPACE_SETTINGS_CACHE_KEY = "medai_workspace_settings_v1";
const OVERVIEW_CACHE_KEY = "medai_overview_state_v1";

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
const MESH_ANATOMY_PRESETS: Record<MeshAnatomyPreset, string[]> = {
  brain: [
    "Frontal lobe",
    "Parietal lobe",
    "Temporal lobe",
    "Occipital lobe",
    "Cerebellum",
    "Brainstem",
    "Insula",
    "Thalamus",
    "Basal ganglia",
    "Ventricles",
    "Corpus callosum",
    "Cingulate",
  ],
  breast: [
    "Skin envelope",
    "Fibroglandular tissue",
    "Adipose layer",
    "Ductal region",
    "Chest wall",
    "Pectoral muscle",
    "Axillary tail",
    "Vascular bundle",
  ],
  abdomen: [
    "Liver",
    "Spleen",
    "Kidney",
    "Pancreas",
    "Stomach",
    "Bowel",
    "Aorta",
    "IVC",
    "Adipose",
  ],
  generic: [
    "Region A",
    "Region B",
    "Region C",
    "Region D",
    "Region E",
    "Region F",
  ],
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
const MESH_OVERLAY_LIMIT = 10;
const MESH_OVERLAY_MATERIAL_PRESETS: Array<{
  id: OverlayMaterialPreset;
  label: string;
  color: number;
}> = [
  {
    id: "brain",
    label: MESH_MATERIAL_PRESETS.brain.label,
    color: MESH_MATERIAL_PRESETS.brain.color,
  },
  {
    id: "bone",
    label: MESH_MATERIAL_PRESETS.bone.label,
    color: MESH_MATERIAL_PRESETS.bone.color,
  },
  {
    id: "muscle",
    label: MESH_MATERIAL_PRESETS.muscle.label,
    color: MESH_MATERIAL_PRESETS.muscle.color,
  },
  {
    id: "vessel",
    label: MESH_MATERIAL_PRESETS.vessel.label,
    color: MESH_MATERIAL_PRESETS.vessel.color,
  },
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [postAuthPath, setPostAuthPath] = useState<string>("/");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>("");
  const [authNotice, setAuthNotice] = useState<string>("");
  const [authUsername, setAuthUsername] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [isCapsLockOn, setIsCapsLockOn] = useState<boolean>(false);
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
  const [uploadDropActive, setUploadDropActive] = useState<boolean>(false);
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
  const [meshOpacity, setMeshOpacity] = useState<number>(0.95);
  const [meshVolumeEnabled, setMeshVolumeEnabled] = useState<boolean>(true);
  const [meshVolumeOpacity, setMeshVolumeOpacity] = useState<number>(0.18);
  const [meshVolumeColormap, setMeshVolumeColormap] =
    useState<VolumeColorMap>("grayscale");
  const [meshVesselEnabled, setMeshVesselEnabled] =
    useState<boolean>(false);
  const [meshVesselThreshold, setMeshVesselThreshold] =
    useState<number>(0.25);
  const [meshVesselSigmaMin, setMeshVesselSigmaMin] = useState<number>(1);
  const [meshVesselSigmaMax, setMeshVesselSigmaMax] = useState<number>(3);
  const [meshVesselStep, setMeshVesselStep] = useState<number>(3);
  const [meshOverlayEnabled, setMeshOverlayEnabled] = useState<boolean>(true);
  const [meshOverlayItems, setMeshOverlayItems] = useState<MeshOverlayItem[]>([]);
  const [activeMeshOverlayId, setActiveMeshOverlayId] = useState<string | null>(
    null
  );
  const [meshOverlayFiles, setMeshOverlayFiles] = useState<File[]>([]);
  const [meshOverlayUploading, setMeshOverlayUploading] = useState<boolean>(false);
  const [meshOverlayDropActive, setMeshOverlayDropActive] =
    useState<boolean>(false);
  const [meshOverlayOpacity, setMeshOverlayOpacity] = useState<number>(0.55);
  const [meshOverlayIso, setMeshOverlayIso] = useState<number>(0.35);
  const [meshOverlayStep, setMeshOverlayStep] = useState<number>(2);
  const [meshOverlayLockEnabled, setMeshOverlayLockEnabled] =
    useState<boolean>(true);
  const [meshOverlayLockTarget, setMeshOverlayLockTarget] =
    useState<string>("base");
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
  const [meshPickedLabel, setMeshPickedLabel] = useState<string>("");
  const [meshLabelEnabled, setMeshLabelEnabled] = useState<boolean>(true);
  const [meshAnatomyEnabled, setMeshAnatomyEnabled] =
    useState<boolean>(false);
  const [meshAnatomyPreset, setMeshAnatomyPreset] =
    useState<MeshAnatomyPreset>("brain");
  const [meshSignalEnabled, setMeshSignalEnabled] =
    useState<boolean>(false);
  const [meshSignalSpeed, setMeshSignalSpeed] = useState<number>(1);
  const [meshSignalTargetId, setMeshSignalTargetId] =
    useState<string>("base");
  const [meshPartOffsets, setMeshPartOffsets] = useState<Record<number, number>>(
    {}
  );
  const [meshLoading, setMeshLoading] = useState<boolean>(false);
  const [meshError, setMeshError] = useState<string>("");
  const [meshVertexCount, setMeshVertexCount] = useState<number>(0);
  const [meshCanSculpt, setMeshCanSculpt] = useState<boolean>(true);
  const [meshRevision, setMeshRevision] = useState<number>(0);
  const [meshOverlayRevision, setMeshOverlayRevision] = useState<number>(0);
  const [viewerMountKey, setViewerMountKey] = useState<number>(0);
  const [meshMountKey, setMeshMountKey] = useState<number>(0);
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
  const [workspacePath, setWorkspacePath] = useState<string>("");
  const [workspaceUploads, setWorkspaceUploads] = useState<
    WorkspaceUploadItem[]
  >([]);
  const [activeWorkspaceIndex, setActiveWorkspaceIndex] = useState<number>(0);
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
  const meshVolumeStateRef = useRef<Viewer3DState | null>(null);
  const meshVolumeCleanupRef = useRef<(() => void) | null>(null);
  const meshOverlayItemsRef = useRef<MeshOverlayItem[]>([]);
  const meshOverlayMeshSyncRef = useRef<number>(0);
  const meshCameraSnapshotRef = useRef<{
    position: [number, number, number];
    target: [number, number, number];
    up: [number, number, number];
  } | null>(null);
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
  const meshSignalEnabledRef = useRef<boolean>(meshSignalEnabled);
  const meshSignalSpeedRef = useRef<number>(meshSignalSpeed);
  const meshSignalTargetIdRef = useRef<string>(meshSignalTargetId);
  const meshOverlayOpacityRef = useRef<number>(meshOverlayOpacity);
  const activeMeshOverlayIdRef = useRef<string | null>(activeMeshOverlayId);
  const workspaceItemVisibleRef = useRef<boolean>(true);
  const workspaceTransformRef = useRef<{
    position: [number, number, number];
    rotation: [number, number, number];
  }>({
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  });
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
  const workspaceShellRef = useRef<HTMLDivElement | null>(null);
  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);
  const loginScreenRef = useRef<HTMLDivElement | null>(null);
  const loginBrainRef = useRef<HTMLDivElement | null>(null);
  const loginBrainCleanupRef = useRef<(() => void) | null>(null);
  const slicePrefetchRef = useRef<SliceIndex | null>(null);
  const volumeInfoPathRef = useRef<string>("");
  const volumeInfoRequestRef = useRef<string>("");
  const volumeInfoRequestTimeRef = useRef<number>(0);
  const previewPathRef = useRef<string>("");
  const setViewerContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      viewerRef.current = null;
      return;
    }
    if (viewerRef.current !== node) {
      viewerRef.current = node;
      setViewerMountKey((prev) => prev + 1);
    }
  }, []);
  const setMeshContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      meshViewerRef.current = null;
      return;
    }
    if (meshViewerRef.current !== node) {
      meshViewerRef.current = node;
      setMeshMountKey((prev) => prev + 1);
    }
  }, []);
  const getWorkspaceBounds = useCallback(() => {
    const shell = workspaceShellRef.current;
    if (!shell) {
      return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    }
    const rect = shell.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }, []);
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

  const isWorkspace = useMemo(
    () => enableViewerWorkspace && location.pathname === "/workspace",
    [enableViewerWorkspace, location.pathname]
  );
  const activeWorkspaceItem = useMemo(
    () => workspaceUploads.find((item) => item.path === workspacePath) ?? null,
    [workspaceUploads, workspacePath]
  );
  const workspaceItemVisible = activeWorkspaceItem?.visible ?? true;

  useEffect(() => {
    if (!isWorkspace) return;
    const params = new URLSearchParams(location.search);
    const path = params.get("path") ?? "";
    const view = params.get("view");
    const mode = params.get("mode");
    if (path && path !== workspacePath) {
      setWorkspacePath(path);
    }
    if (view === "2d" || view === "3d") {
      setViewerMode(view);
    }
    if (mode === "volume" || mode === "mesh") {
      setViewer3dMode(mode);
    }
  }, [isWorkspace, location.search, workspacePath]);

  useEffect(() => {
    meshBrushRef.current = meshBrushSize;
  }, [meshBrushSize]);

  useEffect(() => {
    if (meshSource === "mask" && meshVesselEnabled) {
      setMeshVesselEnabled(false);
    }
  }, [meshSource, meshVesselEnabled]);

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
    meshOverlayOpacityRef.current = meshOverlayOpacity;
  }, [meshOverlayOpacity]);

  useEffect(() => {
    workspaceItemVisibleRef.current = workspaceItemVisible;
  }, [workspaceItemVisible]);

  useEffect(() => {
    activeMeshOverlayIdRef.current = activeMeshOverlayId;
  }, [activeMeshOverlayId]);

  useEffect(() => {
    const raw = localStorage.getItem(WORKSPACE_UPLOADS_CACHE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as WorkspaceUploadCacheItem[];
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const position: [number, number, number] =
            Array.isArray(item.position) && item.position.length === 3
              ? [
                  Number(item.position[0]) || 0,
                  Number(item.position[1]) || 0,
                  Number(item.position[2]) || 0,
                ]
              : [0, 0, 0];
          const rotation: [number, number, number] =
            Array.isArray(item.rotation) && item.rotation.length === 3
              ? [
                  Number(item.rotation[0]) || 0,
                  Number(item.rotation[1]) || 0,
                  Number(item.rotation[2]) || 0,
                ]
              : [0, 0, 0];
          return {
            path: typeof item.path === "string" ? item.path : "",
            label:
              typeof item.label === "string" && item.label.length > 0
                ? item.label
                : typeof item.path === "string"
                  ? item.path
                  : "Scan",
            kind: typeof item.kind === "string" ? item.kind : "nifti",
            createdAt:
              typeof item.createdAt === "string"
                ? item.createdAt
                : new Date().toISOString(),
            visible: typeof item.visible === "boolean" ? item.visible : true,
            position,
            rotation,
          };
        })
        .filter((item) => item.path.length > 0);
      if (normalized.length === 0) return;
      setWorkspaceUploads(normalized);
      setWorkspacePath((prev) => prev || normalized[0].path);
      setActiveWorkspaceIndex((prev) =>
        Math.min(prev, Math.max(0, normalized.length - 1))
      );
    } catch {
      // ignore cache errors
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(MESH_OVERLAY_CACHE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as MeshOverlayCacheItem[];
      if (!Array.isArray(parsed)) return;
      const validPresets = new Set(
        MESH_OVERLAY_MATERIAL_PRESETS.map((preset) => preset.id)
      );
      const normalized = parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const presetId =
            typeof item.materialPreset === "string" &&
            validPresets.has(item.materialPreset)
              ? item.materialPreset
              : MESH_OVERLAY_MATERIAL_PRESETS[0]?.id ?? "brain";
          const opacity =
            typeof item.opacity === "number"
              ? Math.max(0.05, Math.min(item.opacity, 1))
              : 0.75;
          const renderMode =
            item.renderMode === "mesh" || item.renderMode === "volume"
              ? item.renderMode
              : "volume";
          const position =
            Array.isArray(item.position) && item.position.length === 3
              ? [
                  Number(item.position[0]) || 0,
                  Number(item.position[1]) || 0,
                  Number(item.position[2]) || 0,
                ]
              : [0, 0, 0];
          const rotation =
            Array.isArray(item.rotation) && item.rotation.length === 3
              ? [
                  Number(item.rotation[0]) || 0,
                  Number(item.rotation[1]) || 0,
                  Number(item.rotation[2]) || 0,
                ]
              : [0, 0, 0];
          const clipEnabled =
            typeof item.clipEnabled === "boolean" ? item.clipEnabled : false;
          const clipAxis =
            item.clipAxis === "x" || item.clipAxis === "y" || item.clipAxis === "z"
              ? item.clipAxis
              : "z";
          const clipValue =
            typeof item.clipValue === "number"
              ? Math.max(0, Math.min(item.clipValue, 1))
              : 0;
          const normalizedClipValue =
            !clipEnabled && clipValue === 0.5 ? 0 : clipValue;
          const explodeEnabled =
            typeof item.explodeEnabled === "boolean" ? item.explodeEnabled : false;
          const explodeDistance =
            typeof item.explodeDistance === "number"
              ? Math.max(0, Math.min(item.explodeDistance, 1))
              : 0.25;
          return {
            id:
              typeof item.id === "string" && item.id.length > 0
                ? item.id
                : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            path: typeof item.path === "string" ? item.path : "",
            label:
              typeof item.label === "string" && item.label.length > 0
                ? item.label
                : typeof item.path === "string"
                  ? item.path
                  : "Overlay",
            materialPreset: presetId as OverlayMaterialPreset,
            opacity,
            visible: typeof item.visible === "boolean" ? item.visible : true,
            renderMode,
            layer: "overlay" as OverlayLayer,
            position: position as [number, number, number],
            rotation: rotation as [number, number, number],
            clipEnabled,
            clipAxis,
            clipValue: normalizedClipValue,
            explodeEnabled,
            explodeDistance,
          } as MeshOverlayItem;
        })
        .filter((item) => item.path.length > 0);
      if (normalized.length === 0) return;
      const limited = normalized.slice(0, MESH_OVERLAY_LIMIT);
      setMeshOverlayItems(limited);
    } catch {
      // ignore cache errors
    }
  }, []);

  const workspaceSettingsLoadedRef = useRef<boolean>(false);
  const overviewSettingsLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isWorkspace || workspaceSettingsLoadedRef.current) return;
    workspaceSettingsLoadedRef.current = true;
    const raw = localStorage.getItem(WORKSPACE_SETTINGS_CACHE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as WorkspaceSettingsCache;
      if (!parsed || typeof parsed !== "object") return;
      const params = new URLSearchParams(location.search);
      const viewParam = params.get("view");
      const modeParam = params.get("mode");
      const hasViewOverride = viewParam === "2d" || viewParam === "3d";
      const hasModeOverride = modeParam === "volume" || modeParam === "mesh";
      if (
        !hasViewOverride &&
        (parsed.viewerMode === "2d" || parsed.viewerMode === "3d")
      ) {
        setViewerMode(parsed.viewerMode);
      }
      if (
        !hasModeOverride &&
        (parsed.viewer3dMode === "volume" || parsed.viewer3dMode === "mesh")
      ) {
        setViewer3dMode(parsed.viewer3dMode);
      }
      if (
        typeof parsed.sliceColormap === "string" &&
        SLICE_COLORMAPS.some((item) => item.id === parsed.sliceColormap)
      ) {
        setSliceColormap(parsed.sliceColormap);
      }
      if (
        typeof parsed.volumeColormap === "string" &&
        VOLUME_COLORMAPS.some((item) => item.id === parsed.volumeColormap)
      ) {
        setVolumeColormap(parsed.volumeColormap);
      }
      if (typeof parsed.volumeOpacity === "number") {
        setVolumeOpacity(Math.max(0.1, Math.min(parsed.volumeOpacity, 1)));
      }
      if (typeof parsed.clipEnabled === "boolean") {
        setClipEnabled(parsed.clipEnabled);
      }
      if (parsed.clipAxis === "x" || parsed.clipAxis === "y" || parsed.clipAxis === "z") {
        setClipAxis(parsed.clipAxis);
      }
      if (typeof parsed.clipValue === "number") {
        setClipValue(Math.max(0, Math.min(parsed.clipValue, 1)));
      }
      if (
        parsed.meshTool === "orbit" ||
        parsed.meshTool === "sculpt" ||
        parsed.meshTool === "carve" ||
        parsed.meshTool === "select" ||
        parsed.meshTool === "label"
      ) {
        setMeshTool(parsed.meshTool);
      }
      if (typeof parsed.meshIso === "number") {
        setMeshIso(Math.max(0.05, Math.min(parsed.meshIso, 1)));
      }
      if (typeof parsed.meshStep === "number") {
        setMeshStep(Math.max(1, Math.min(parsed.meshStep, 6)));
      }
      if (parsed.meshSource === "scan" || parsed.meshSource === "mask") {
        setMeshSource(parsed.meshSource);
      }
      if (typeof parsed.meshOpacity === "number") {
        setMeshOpacity(Math.max(0.1, Math.min(parsed.meshOpacity, 1)));
      }
      if (typeof parsed.meshVolumeEnabled === "boolean") {
        setMeshVolumeEnabled(parsed.meshVolumeEnabled);
      }
      if (typeof parsed.meshVolumeOpacity === "number") {
        setMeshVolumeOpacity(Math.max(0, Math.min(parsed.meshVolumeOpacity, 0.8)));
      }
      if (
        typeof parsed.meshVolumeColormap === "string" &&
        VOLUME_COLORMAPS.some((item) => item.id === parsed.meshVolumeColormap)
      ) {
        setMeshVolumeColormap(parsed.meshVolumeColormap);
      }
      if (typeof parsed.meshVesselEnabled === "boolean") {
        setMeshVesselEnabled(parsed.meshVesselEnabled);
      }
      if (typeof parsed.meshVesselThreshold === "number") {
        setMeshVesselThreshold(Math.max(0.05, Math.min(parsed.meshVesselThreshold, 1)));
      }
      if (typeof parsed.meshVesselSigmaMin === "number") {
        setMeshVesselSigmaMin(Math.max(0.5, Math.min(parsed.meshVesselSigmaMin, 8)));
      }
      if (typeof parsed.meshVesselSigmaMax === "number") {
        setMeshVesselSigmaMax(Math.max(1, Math.min(parsed.meshVesselSigmaMax, 12)));
      }
      if (typeof parsed.meshVesselStep === "number") {
        setMeshVesselStep(Math.max(1, Math.min(parsed.meshVesselStep, 8)));
      }
      if (typeof parsed.meshOverlayEnabled === "boolean") {
        setMeshOverlayEnabled(parsed.meshOverlayEnabled);
      }
      if (typeof parsed.meshOverlayOpacity === "number") {
        setMeshOverlayOpacity(Math.max(0.1, Math.min(parsed.meshOverlayOpacity, 1)));
      }
      if (typeof parsed.meshOverlayIso === "number") {
        setMeshOverlayIso(Math.max(0.05, Math.min(parsed.meshOverlayIso, 1)));
      }
      if (typeof parsed.meshOverlayStep === "number") {
        setMeshOverlayStep(Math.max(1, Math.min(parsed.meshOverlayStep, 6)));
      }
      if (typeof parsed.meshOverlayLockEnabled === "boolean") {
        setMeshOverlayLockEnabled(parsed.meshOverlayLockEnabled);
      }
      if (typeof parsed.meshOverlayLockTarget === "string") {
        setMeshOverlayLockTarget(parsed.meshOverlayLockTarget);
      }
      if (typeof parsed.meshWireframe === "boolean") {
        setMeshWireframe(parsed.meshWireframe);
      }
      if (typeof parsed.meshClipEnabled === "boolean") {
        setMeshClipEnabled(parsed.meshClipEnabled);
      }
      if (
        parsed.meshClipAxis === "x" ||
        parsed.meshClipAxis === "y" ||
        parsed.meshClipAxis === "z"
      ) {
        setMeshClipAxis(parsed.meshClipAxis);
      }
      if (typeof parsed.meshClipValue === "number") {
        setMeshClipValue(Math.max(0, Math.min(parsed.meshClipValue, 1)));
      }
      if (typeof parsed.meshExplodeEnabled === "boolean") {
        setMeshExplodeEnabled(parsed.meshExplodeEnabled);
      }
      if (typeof parsed.meshExplodeDistance === "number") {
        setMeshExplodeDistance(Math.max(0, Math.min(parsed.meshExplodeDistance, 1)));
      }
      if (
        typeof parsed.meshMaterialPreset === "string" &&
        Object.prototype.hasOwnProperty.call(
          MESH_MATERIAL_PRESETS,
          parsed.meshMaterialPreset
        )
      ) {
        setMeshMaterialPreset(parsed.meshMaterialPreset as MeshMaterialPreset);
      }
      if (typeof parsed.meshGroupCount === "number") {
        setMeshGroupCount(
          Math.max(1, Math.min(Math.floor(parsed.meshGroupCount), MAX_MESH_PARTS))
        );
      }
      if (typeof parsed.meshSelectionRadius === "number") {
        setMeshSelectionRadius(Math.max(1, Math.min(parsed.meshSelectionRadius, 50)));
      }
      if (typeof parsed.meshSelectionStrength === "number") {
        setMeshSelectionStrength(
          Math.max(0.05, Math.min(parsed.meshSelectionStrength, 1))
        );
      }
      if (typeof parsed.meshSelectionPrecision === "boolean") {
        setMeshSelectionPrecision(parsed.meshSelectionPrecision);
      }
      if (typeof parsed.meshLabelEnabled === "boolean") {
        setMeshLabelEnabled(parsed.meshLabelEnabled);
      }
      if (typeof parsed.meshAnatomyEnabled === "boolean") {
        setMeshAnatomyEnabled(parsed.meshAnatomyEnabled);
      }
      if (
        typeof parsed.meshAnatomyPreset === "string" &&
        Object.prototype.hasOwnProperty.call(
          MESH_ANATOMY_PRESETS,
          parsed.meshAnatomyPreset
        )
      ) {
        setMeshAnatomyPreset(parsed.meshAnatomyPreset as MeshAnatomyPreset);
      }
      if (typeof parsed.meshSignalEnabled === "boolean") {
        setMeshSignalEnabled(parsed.meshSignalEnabled);
      }
      if (typeof parsed.meshSignalSpeed === "number") {
        setMeshSignalSpeed(Math.max(0.4, Math.min(parsed.meshSignalSpeed, 3)));
      }
      if (typeof parsed.meshSignalTargetId === "string") {
        setMeshSignalTargetId(parsed.meshSignalTargetId);
      }
      if (typeof parsed.overlayOpacity === "number") {
        setOverlayOpacity(Math.max(0.05, Math.min(parsed.overlayOpacity, 1)));
      }
      if (
        parsed.workspaceTool === "brush" ||
        parsed.workspaceTool === "erase" ||
        parsed.workspaceTool === "rect" ||
        parsed.workspaceTool === "measure"
      ) {
        setWorkspaceTool(parsed.workspaceTool);
      }
      if (typeof parsed.brushSize === "number") {
        setBrushSize(Math.max(2, Math.min(parsed.brushSize, 80)));
      }
    } catch {
      // ignore cache errors
    }
  }, [isWorkspace, location.search]);

  useEffect(() => {
    if (isWorkspace || overviewSettingsLoadedRef.current) return;
    overviewSettingsLoadedRef.current = true;
    const raw = localStorage.getItem(OVERVIEW_CACHE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as OverviewCache;
      if (!parsed || typeof parsed !== "object") return;
      if (parsed.uploadResult) {
        setUploadResult(parsed.uploadResult);
      }
      if (parsed.uploadPreview) {
        setUploadPreview(parsed.uploadPreview);
      }
      if (typeof parsed.previewPath === "string") {
        setPreviewPath(parsed.previewPath);
      }
      if (parsed.volumeInfo) {
        setVolumeInfo(parsed.volumeInfo);
      }
      if (parsed.sliceIndex) {
        setSliceIndex(parsed.sliceIndex);
      }
      if (parsed.sliceRequestIndex) {
        setSliceRequestIndex(parsed.sliceRequestIndex);
      }
      if (typeof parsed.viewerChannel === "number") {
        setViewerChannel(parsed.viewerChannel);
      }
      if (parsed.viewerMode === "2d" || parsed.viewerMode === "3d") {
        setViewerMode(parsed.viewerMode);
      }
      if (parsed.viewer3dMode === "volume" || parsed.viewer3dMode === "mesh") {
        setViewer3dMode(parsed.viewer3dMode);
      }
      if (
        typeof parsed.sliceColormap === "string" &&
        SLICE_COLORMAPS.some((item) => item.id === parsed.sliceColormap)
      ) {
        setSliceColormap(parsed.sliceColormap);
      }
      if (
        typeof parsed.volumeColormap === "string" &&
        VOLUME_COLORMAPS.some((item) => item.id === parsed.volumeColormap)
      ) {
        setVolumeColormap(parsed.volumeColormap);
      }
      if (typeof parsed.volumeOpacity === "number") {
        setVolumeOpacity(Math.max(0.1, Math.min(parsed.volumeOpacity, 1)));
      }
      if (typeof parsed.clipEnabled === "boolean") {
        setClipEnabled(parsed.clipEnabled);
      }
      if (
        parsed.clipAxis === "x" ||
        parsed.clipAxis === "y" ||
        parsed.clipAxis === "z"
      ) {
        setClipAxis(parsed.clipAxis);
      }
      if (typeof parsed.clipValue === "number") {
        setClipValue(Math.max(0, Math.min(parsed.clipValue, 1)));
      }
      if (typeof parsed.selectedModelId === "string") {
        setSelectedModelId(parsed.selectedModelId);
      }
    } catch {
      // ignore cache errors
    }
  }, [isWorkspace]);

  useEffect(() => {
    const payload: WorkspaceUploadCacheItem[] = workspaceUploads.map((item) => ({
      path: item.path,
      label: item.label,
      kind: item.kind,
      createdAt: item.createdAt,
      visible: item.visible,
      position: item.position,
      rotation: item.rotation,
    }));
    localStorage.setItem(WORKSPACE_UPLOADS_CACHE_KEY, JSON.stringify(payload));
  }, [workspaceUploads]);

  useEffect(() => {
    if (isWorkspace || !overviewSettingsLoadedRef.current) return;
    const payload: OverviewCache = {
      uploadResult: uploadResult ?? undefined,
      uploadPreview: uploadPreview ?? undefined,
      previewPath: previewPath || undefined,
      volumeInfo: volumeInfo ?? undefined,
      sliceIndex,
      sliceRequestIndex,
      viewerChannel,
      viewerMode,
      viewer3dMode,
      sliceColormap,
      volumeColormap,
      volumeOpacity,
      clipEnabled,
      clipAxis,
      clipValue,
      selectedModelId,
    };
    localStorage.setItem(OVERVIEW_CACHE_KEY, JSON.stringify(payload));
  }, [
    isWorkspace,
    uploadResult,
    uploadPreview,
    previewPath,
    volumeInfo,
    sliceIndex,
    sliceRequestIndex,
    viewerChannel,
    viewerMode,
    viewer3dMode,
    sliceColormap,
    volumeColormap,
    volumeOpacity,
    clipEnabled,
    clipAxis,
    clipValue,
    selectedModelId,
  ]);

  useEffect(() => {
    const payload: MeshOverlayCacheItem[] = meshOverlayItems.map((item) => ({
      id: item.id,
      path: item.path,
      label: item.label,
      materialPreset: item.materialPreset,
      opacity: item.opacity,
      visible: item.visible,
      renderMode: item.renderMode,
      position: item.position,
      rotation: item.rotation,
      clipEnabled: item.clipEnabled,
      clipAxis: item.clipAxis,
      clipValue: item.clipValue,
      explodeEnabled: item.explodeEnabled,
      explodeDistance: item.explodeDistance,
    }));
    localStorage.setItem(MESH_OVERLAY_CACHE_KEY, JSON.stringify(payload));
  }, [meshOverlayItems]);

  useEffect(() => {
    if (!isWorkspace) return;
    const payload: WorkspaceSettingsCache = {
      viewerMode,
      viewer3dMode,
      sliceColormap,
      volumeColormap,
      volumeOpacity,
      clipEnabled,
      clipAxis,
      clipValue,
      meshTool,
      meshIso,
      meshStep,
      meshSource,
      meshOpacity,
      meshVolumeEnabled,
      meshVolumeOpacity,
      meshVolumeColormap,
      meshVesselEnabled,
      meshVesselThreshold,
      meshVesselSigmaMin,
      meshVesselSigmaMax,
      meshVesselStep,
      meshOverlayEnabled,
      meshOverlayOpacity,
      meshOverlayIso,
      meshOverlayStep,
      meshOverlayLockEnabled,
      meshOverlayLockTarget,
      meshWireframe,
      meshClipEnabled,
      meshClipAxis,
      meshClipValue,
      meshExplodeEnabled,
      meshExplodeDistance,
      meshMaterialPreset,
      meshGroupCount,
      meshSelectionRadius,
      meshSelectionStrength,
      meshSelectionPrecision,
      meshLabelEnabled,
      meshAnatomyEnabled,
      meshAnatomyPreset,
      meshSignalEnabled,
      meshSignalSpeed,
      meshSignalTargetId,
      overlayOpacity,
      workspaceTool,
      brushSize,
    };
    localStorage.setItem(WORKSPACE_SETTINGS_CACHE_KEY, JSON.stringify(payload));
  }, [
    isWorkspace,
    viewerMode,
    viewer3dMode,
    sliceColormap,
    volumeColormap,
    volumeOpacity,
    clipEnabled,
    clipAxis,
    clipValue,
    meshTool,
    meshIso,
    meshStep,
    meshSource,
    meshOpacity,
    meshVolumeEnabled,
    meshVolumeOpacity,
    meshVolumeColormap,
    meshVesselEnabled,
    meshVesselThreshold,
    meshVesselSigmaMin,
    meshVesselSigmaMax,
    meshVesselStep,
    meshOverlayEnabled,
    meshOverlayOpacity,
    meshOverlayIso,
    meshOverlayStep,
    meshOverlayLockEnabled,
    meshOverlayLockTarget,
    meshWireframe,
    meshClipEnabled,
    meshClipAxis,
    meshClipValue,
    meshExplodeEnabled,
    meshExplodeDistance,
    meshMaterialPreset,
    meshGroupCount,
    meshSelectionRadius,
    meshSelectionStrength,
    meshSelectionPrecision,
    meshLabelEnabled,
    meshAnatomyEnabled,
    meshAnatomyPreset,
    meshSignalEnabled,
    meshSignalSpeed,
    meshSignalTargetId,
    overlayOpacity,
    workspaceTool,
    brushSize,
  ]);

  useEffect(() => {
    if (meshOverlayItems.length === 0) {
      if (activeMeshOverlayId !== null) {
        setActiveMeshOverlayId(null);
      }
      return;
    }
    if (
      activeMeshOverlayId &&
      meshOverlayItems.some((item) => item.id === activeMeshOverlayId)
    ) {
      return;
    }
    setActiveMeshOverlayId(meshOverlayItems[0].id);
  }, [meshOverlayItems, activeMeshOverlayId]);

  useEffect(() => {
    if (meshOverlayLockTarget === "base") return;
    if (meshOverlayItems.some((item) => item.id === meshOverlayLockTarget)) {
      return;
    }
    setMeshOverlayLockTarget("base");
  }, [meshOverlayItems, meshOverlayLockTarget]);

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
    if (isWorkspace) return;
    if (workspacePath) {
      setWorkspacePath("");
    }
  }, [isWorkspace, workspacePath]);

  useEffect(() => {
    if (!isWorkspace) return;
    if (workspacePath) return;
    if (workspaceUploads.length === 0) return;
    setWorkspacePath(workspaceUploads[0].path);
    setActiveWorkspaceIndex(0);
  }, [isWorkspace, workspacePath, workspaceUploads]);

  useEffect(() => {
    if (!isWorkspace) return undefined;
    const updatePositions = () => {
      const rightWidth = panelSizes.right.width;
      const bounds = getWorkspaceBounds();
      const maxX = Math.max(16, bounds.width - rightWidth - 16);
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
  }, [getWorkspaceBounds, isWorkspace, panelSizes.right.width]);

  useEffect(() => {
    if (!isWorkspace) return;
    const clamp = (pos: PanelPosition, size: PanelSize) => {
      const bounds = getWorkspaceBounds();
      const minX = 8;
      const minY = 8;
      const maxX = Math.max(minX, bounds.width - size.width - 8);
      const maxY = Math.max(minY, bounds.height - size.height - 8);
      return {
        x: Math.min(maxX, Math.max(minX, pos.x)),
        y: Math.min(maxY, Math.max(minY, pos.y)),
      };
    };
    setPanelPositions((prev) => ({
      left: clamp(prev.left, panelSizes.left),
      right: clamp(prev.right, panelSizes.right),
    }));
  }, [getWorkspaceBounds, isWorkspace, panelSizes]);

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
  const isAuthRoute = location.pathname.startsWith("/login");
  const isDocsRoute = location.pathname.startsWith("/docs");
  const isAnatomyRoute = location.pathname === "/anatomy";
  const authStepToPath: Record<AuthStep, string> = {
    login: "/login",
    "forgot-request": "/login/forgot",
    "forgot-verify": "/login/forgot/verify",
    "verify-request": "/login/verify",
    "verify-confirm": "/login/verify/confirm",
  };
  const showLogin = (AUTH_REQUIRED && authChecked && !authUser) || isAuthRoute;
  const showAuthGate = AUTH_REQUIRED && !authChecked;
  const isAuthFlow = authStep !== "login";
  const showLoginScene = showLogin || showAuthGate;
  const isForgotFlow =
    authStep === "forgot-request" || authStep === "forgot-verify";
  const isVerifyFlow =
    authStep === "verify-request" || authStep === "verify-confirm";

  const handleCapsLock = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      setIsCapsLockOn(event.getModifierState("CapsLock"));
    },
    []
  );

  const clearCapsLock = useCallback(() => {
    setIsCapsLockOn(false);
  }, []);
  const meshSculptEnabled = meshCanSculpt && !meshExplodeEnabled;
  const activePartOffset = meshPartOffsets[meshActiveGroup] ?? 0;
  const hasPartOffsets = Object.keys(meshPartOffsets).length > 0;
  const meshHint = useMemo(() => {
    if (meshTool === "orbit") {
      return "Orbit tool: drag to rotate, scroll to zoom, right-click to pan. WASD to fly.";
    }
    if (meshTool === "select") {
      return "Select tool: click a part to identify its region and pick voxels. Hold Ctrl or Shift + drag to orbit. WASD to fly.";
    }
    if (meshTool === "label") {
      return "Label tool: click a part to pin an on-screen callout. Hold Ctrl or Shift + drag to orbit. WASD to fly.";
    }
    if (meshExplodeEnabled) {
      return "Explode view: separate anatomy groups. Hold Ctrl or Shift + drag to orbit. WASD to fly.";
    }
    if (meshTool === "sculpt") {
      return "Sculpt tool: drag to add volume. Hold Ctrl or Shift + drag to orbit. WASD to fly.";
    }
    return "Carve tool: drag to remove volume. Hold Ctrl or Shift + drag to orbit. WASD to fly.";
  }, [meshTool, meshExplodeEnabled]);

  useEffect(() => {
    const shouldLock = showLogin || isWorkspace || isAnatomyRoute;
    if (shouldLock) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, [isWorkspace, showLogin, isAnatomyRoute]);

  useEffect(() => {
    if (!isWorkspace) return;
    const baseVisible = workspaceItemVisible;
    const viewerState = viewer3dStateRef.current;
    if (viewerState?.volume?.setVisibility) {
      viewerState.volume.setVisibility(baseVisible);
      viewerState.renderWindow?.render?.();
    }
    const meshVolumeState = meshVolumeStateRef.current;
    if (meshVolumeState?.volume?.setVisibility) {
      meshVolumeState.volume.setVisibility(baseVisible);
      meshVolumeState.renderWindow?.render?.();
    }
    const meshState = meshStateRef.current;
    if (meshState?.meshGroup) {
      meshState.meshGroup.visible = baseVisible;
    }
  }, [isWorkspace, workspaceItemVisible]);

  useEffect(() => {
    if (!isWorkspace) return;
    const position = activeWorkspaceItem?.position ?? [0, 0, 0];
    const rotation = activeWorkspaceItem?.rotation ?? [0, 0, 0];
    const nextPosition: [number, number, number] = [
      Number(position[0]) || 0,
      Number(position[1]) || 0,
      Number(position[2]) || 0,
    ];
    const nextRotation: [number, number, number] = [
      Number(rotation[0]) || 0,
      Number(rotation[1]) || 0,
      Number(rotation[2]) || 0,
    ];
    workspaceTransformRef.current = {
      position: nextPosition,
      rotation: nextRotation,
    };
    const viewerState = viewer3dStateRef.current;
    if (viewerState?.volume) {
      if (typeof viewerState.volume.setPosition === "function") {
        viewerState.volume.setPosition(
          nextPosition[0],
          nextPosition[1],
          nextPosition[2]
        );
      }
      if (typeof viewerState.volume.setOrientation === "function") {
        viewerState.volume.setOrientation(
          nextRotation[0],
          nextRotation[1],
          nextRotation[2]
        );
      }
      viewerState.renderWindow?.render?.();
    }
    const meshVolumeState = meshVolumeStateRef.current;
    if (meshVolumeState?.volume) {
      if (typeof meshVolumeState.volume.setPosition === "function") {
        meshVolumeState.volume.setPosition(
          nextPosition[0],
          nextPosition[1],
          nextPosition[2]
        );
      }
      if (typeof meshVolumeState.volume.setOrientation === "function") {
        meshVolumeState.volume.setOrientation(
          nextRotation[0],
          nextRotation[1],
          nextRotation[2]
        );
      }
      meshVolumeState.renderWindow?.render?.();
    }
    const meshState = meshStateRef.current;
    if (meshState?.meshGroup) {
      meshState.meshGroup.position.set(
        nextPosition[0],
        nextPosition[1],
        nextPosition[2]
      );
      meshState.meshGroup.rotation.set(
        (nextRotation[0] * Math.PI) / 180,
        (nextRotation[1] * Math.PI) / 180,
        (nextRotation[2] * Math.PI) / 180
      );
    }
  }, [isWorkspace, activeWorkspaceItem]);

  const resolveAuthStepFromPath = useCallback((path: string): AuthStep => {
    if (path === "/login/forgot") return "forgot-request";
    if (path === "/login/forgot/verify") return "forgot-verify";
    if (path === "/login/verify") return "verify-request";
    if (path === "/login/verify/confirm") return "verify-confirm";
    return "login";
  }, []);

  useEffect(() => {
    if (!showLogin) return;
    if (!isAuthRoute) {
      setPostAuthPath(`${location.pathname}${location.search}`);
      navigate("/login", { replace: true });
      return;
    }
    const nextStep = resolveAuthStepFromPath(location.pathname);
    if (nextStep !== authStep) {
      setAuthStep(nextStep);
    }
  }, [
    authStep,
    isAuthRoute,
    location.pathname,
    location.search,
    navigate,
    resolveAuthStepFromPath,
    showLogin,
  ]);

  useEffect(() => {
    if (!authUser) return;
    if (location.pathname.startsWith("/login")) {
      navigate(postAuthPath || "/", { replace: true });
    }
  }, [authUser, location.pathname, navigate, postAuthPath]);

  const setAuthStepAndRoute = useCallback(
    (nextStep: AuthStep) => {
      setAuthStep(nextStep);
      if (!showLogin) return;
      const targetPath = authStepToPath[nextStep];
      if (location.pathname !== targetPath) {
        navigate(targetPath, { replace: true });
      }
    },
    [authStepToPath, location.pathname, navigate, showLogin]
  );

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
    setAuthStepAndRoute("login");
  }, [setAuthStepAndRoute]);

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
    if (volumeInfoPathRef.current === path) {
      return;
    }
    if (volumeInfoRequestRef.current === path) {
      const elapsed = Date.now() - volumeInfoRequestTimeRef.current;
      if (elapsed < 1500) {
        return;
      }
    }
    volumeInfoRequestRef.current = path;
    volumeInfoRequestTimeRef.current = Date.now();
    try {
      setViewerError("");
      setViewerLoading(true);
      const res = await apiFetch(
        `${API_BASE}/api/uploads/volume-info?path=${encodeURIComponent(path)}`
      );
      if (!res.ok) throw new Error(`Viewer API failed (${res.status})`);
      const data = (await res.json()) as VolumeInfo;
      setVolumeInfo(data);
      volumeInfoPathRef.current = path;
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to load volume metadata.";
      setViewerError(message);
      setVolumeInfo(null);
      volumeInfoPathRef.current = "";
    } finally {
      setViewerLoading(false);
      if (volumeInfoRequestRef.current === path) {
        volumeInfoRequestRef.current = "";
      }
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!uploadPath) {
      volumeInfoPathRef.current = "";
      volumeInfoRequestRef.current = "";
      setVolumeInfo(null);
      setViewerError("");
      return;
    }
    if (AUTH_REQUIRED && !isAuthenticated) return;
    fetchVolumeInfo(uploadPath);
  }, [fetchVolumeInfo, uploadPath, isAuthenticated]);

  useEffect(() => {
    if (!uploadPath) {
      previewPathRef.current = "";
      setPreviewPath("");
      return;
    }
    if (AUTH_REQUIRED && !isAuthenticated) return;
    if (previewPath === uploadPath) return;
    if (previewPathRef.current === uploadPath) return;
    previewPathRef.current = uploadPath;
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
      } finally {
        if (previewPathRef.current === uploadPath) {
          previewPathRef.current = "";
        }
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

  const buildVolumeFileUrlFor = useCallback(
    (path: string, channelOverride?: number) => {
      const params = new URLSearchParams({
        path,
        channel: String(channelOverride ?? viewerChannel),
        t: String(Date.now()),
      });
      if (authToken) {
        params.set("token", authToken);
      }
      return `${API_BASE}/api/uploads/volume-file?${params.toString()}`;
    },
    [authToken, viewerChannel]
  );

  const buildMeshUrl = useCallback(
    (
      pathOverride?: string,
      isoOverride?: number,
      stepOverride?: number,
      channelOverride?: number,
      options?: { disableVessel?: boolean; label?: number }
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
      if (typeof options?.label === "number") {
        params.set("label", String(options.label));
      }
      if (authToken) {
        params.set("token", authToken);
      }
      return `${API_BASE}/api/uploads/mesh?${params.toString()}`;
    },
    [
      uploadPath,
      viewerChannel,
      meshIso,
      meshStep,
      meshRevision,
      authToken,
    ]
  );

  const fallbackMaskPath = useMemo(() => {
    if (!jobHistory.length) return "";
    const candidates = jobHistory.filter(
      (item) => item.status === "done" && Boolean(item.outputs?.mask_path)
    );
    if (!candidates.length) return "";
    if (!uploadPath) return candidates[0]?.outputs?.mask_path ?? "";
    const match = candidates.find((item) => item.input_path === uploadPath);
    return match?.outputs?.mask_path ?? candidates[0]?.outputs?.mask_path ?? "";
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
    () => (meshSource === "scan" ? meshMaskPath : ""),
    [meshSource, meshMaskPath]
  );

  useEffect(() => {
    meshOverlayItemsRef.current = meshOverlayItems;
  }, [meshOverlayItems]);

  const getOverlayMaterialPreset = useCallback(
    (presetId: OverlayMaterialPreset) => {
      return (
        MESH_OVERLAY_MATERIAL_PRESETS.find((preset) => preset.id === presetId) ??
        MESH_OVERLAY_MATERIAL_PRESETS[0]
      );
    },
    []
  );
  const getOverlayPreset = useCallback(
    (presetId: OverlayMaterialPreset) => getOverlayMaterialPreset(presetId),
    [getOverlayMaterialPreset]
  );

  const getOverlayLockTransform = useCallback(() => {
    const position: [number, number, number] = [0, 0, 0];
    const rotation: [number, number, number] = [0, 0, 0];
    if (!meshOverlayLockEnabled) {
      return { position, rotation };
    }
    if (meshOverlayLockTarget === "base") {
      return { position, rotation };
    }
    const target = meshOverlayItemsRef.current.find(
      (item) => item.id === meshOverlayLockTarget
    );
    if (!target) {
      return { position, rotation };
    }
    const targetPosition = target.position ?? position;
    const targetRotation = target.rotation ?? rotation;
    return {
      position: [
        Number(targetPosition[0]) || 0,
        Number(targetPosition[1]) || 0,
        Number(targetPosition[2]) || 0,
      ],
      rotation: [
        Number(targetRotation[0]) || 0,
        Number(targetRotation[1]) || 0,
        Number(targetRotation[2]) || 0,
      ],
    };
  }, [meshOverlayLockEnabled, meshOverlayLockTarget]);

  const applyOverlayLockTransform = useCallback(
    (mesh: any) => {
      if (!mesh) return;
      const { position, rotation } = getOverlayLockTransform();
      mesh.position.set(position[0], position[1], position[2]);
      mesh.rotation.set(
        (rotation[0] * Math.PI) / 180,
        (rotation[1] * Math.PI) / 180,
        (rotation[2] * Math.PI) / 180
      );
    },
    [getOverlayLockTransform]
  );

  const colorToRgb = useCallback((hexColor: number) => {
    const r = (hexColor >> 16) & 255;
    const g = (hexColor >> 8) & 255;
    const b = hexColor & 255;
    return [r / 255, g / 255, b / 255] as [number, number, number];
  }, []);

  const applyOverlayTransfer = useCallback(
    (
      ctfun: any,
      ofun: any,
      dataRange: [number, number],
      presetId: OverlayMaterialPreset,
      opacity: number
    ) => {
      const [min, max] = dataRange;
      const range = max - min || 1;
      const preset = getOverlayPreset(presetId);
      const color = colorToRgb(preset.color);
      const mid = min + range * 0.45;
      const hi = min + range * 0.8;
      const opacityScale = Math.max(0.05, Math.min(opacity, 0.95));
      ctfun.removeAllPoints();
      ctfun.addRGBPoint(min, 0.0, 0.0, 0.0);
      ctfun.addRGBPoint(mid, color[0] * 0.6, color[1] * 0.6, color[2] * 0.6);
      ctfun.addRGBPoint(hi, color[0], color[1], color[2]);
      ctfun.addRGBPoint(max, color[0], color[1], color[2]);
      ofun.removeAllPoints();
      ofun.addPoint(min, 0.0);
      ofun.addPoint(mid, 0.08 * opacityScale);
      ofun.addPoint(hi, 0.35 * opacityScale);
      ofun.addPoint(max, 0.7 * opacityScale);
    },
    [colorToRgb, getOverlayPreset]
  );

  const requestMeshRebuild = useCallback(() => {
    if (!uploadPath) return;
    setMeshRevision((value) => value + 1);
  }, [uploadPath]);

  const syncMeshOverlayVolumes = useCallback(async () => {
    const state = meshVolumeStateRef.current;
    if (!state || !state.overlayLoader) return;
    const items = meshOverlayItemsRef.current.filter(
      (item) => item.renderMode !== "mesh"
    );
    const normalizeVector = (
      value: MeshOverlayItem["position"] | MeshOverlayItem["rotation"]
    ): [number, number, number] => {
      if (Array.isArray(value) && value.length === 3) {
        return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
      }
      return [0, 0, 0];
    };
    const applyOverlayTransform = (
      overlay: MeshOverlayVolume,
      item: MeshOverlayItem
    ) => {
      const position = normalizeVector(item.position);
      const rotation = normalizeVector(item.rotation);
      const maxDim = Math.max(
        overlay.dimensions[0] * overlay.spacing[0],
        overlay.dimensions[1] * overlay.spacing[1],
        overlay.dimensions[2] * overlay.spacing[2]
      ) || 1;
      const explodeDistance =
        (item.explodeDistance ?? 0) * Math.max(1, maxDim);
      const len = Math.hypot(position[0], position[1], position[2]);
      const direction: [number, number, number] =
        len > 0.0001
          ? [position[0] / len, position[1] / len, position[2] / len]
          : [0, 0, 1];
      const finalPosition =
        item.explodeEnabled
          ? [
              position[0] + direction[0] * explodeDistance,
              position[1] + direction[1] * explodeDistance,
              position[2] + direction[2] * explodeDistance,
            ]
          : position;
      if (typeof overlay.volume?.setPosition === "function") {
        overlay.volume.setPosition(
          finalPosition[0],
          finalPosition[1],
          finalPosition[2]
        );
      }
      if (typeof overlay.volume?.setOrientation === "function") {
        overlay.volume.setOrientation(rotation[0], rotation[1], rotation[2]);
      }
      overlay.position = position;
      overlay.rotation = rotation;
      overlay.explodeEnabled = item.explodeEnabled ?? false;
      overlay.explodeDistance = item.explodeDistance ?? 0.25;
    };
    const applyOverlayClip = (
      overlay: MeshOverlayVolume,
      item: MeshOverlayItem
    ) => {
      if (typeof overlay.mapper?.removeAllClippingPlanes === "function") {
        overlay.mapper.removeAllClippingPlanes();
      }
      if (!item.clipEnabled) {
        overlay.clipPlane = null;
        overlay.clipEnabled = false;
        return;
      }
      const vtkPlane = vtkPlaneRef.current;
      if (!vtkPlane) return;
      const plane = overlay.clipPlane ?? vtkPlane.newInstance();
      let minX = 0;
      let maxX = 0;
      let minY = 0;
      let maxY = 0;
      let minZ = 0;
      let maxZ = 0;
      if (typeof overlay.volume?.getBounds === "function") {
        const bounds = overlay.volume.getBounds();
        if (Array.isArray(bounds) && bounds.length >= 6) {
          [minX, maxX, minY, maxY, minZ, maxZ] = bounds;
        }
      }
      if (minX === maxX && minY === maxY && minZ === maxZ) {
        const [dx, dy, dz] = overlay.dimensions;
        const [sx, sy, sz] = overlay.spacing;
        const sizeX = dx * sx;
        const sizeY = dy * sy;
        const sizeZ = dz * sz;
        const origin = overlay.origin ?? [
          -sizeX / 2,
          -sizeY / 2,
          -sizeZ / 2,
        ];
        minX = origin[0];
        minY = origin[1];
        minZ = origin[2];
        maxX = minX + sizeX;
        maxY = minY + sizeY;
        maxZ = minZ + sizeZ;
      }
      const value = Math.max(0, Math.min(item.clipValue ?? 0.5, 1));
      if (item.clipAxis === "x") {
        plane.setNormal(1, 0, 0);
        plane.setOrigin(minX + (maxX - minX) * value, minY, minZ);
      } else if (item.clipAxis === "y") {
        plane.setNormal(0, 1, 0);
        plane.setOrigin(minX, minY + (maxY - minY) * value, minZ);
      } else {
        plane.setNormal(0, 0, 1);
        plane.setOrigin(minX, minY, minZ + (maxZ - minZ) * value);
      }
      if (typeof overlay.mapper?.addClippingPlane === "function") {
        overlay.mapper.addClippingPlane(plane);
      }
      overlay.clipPlane = plane;
      overlay.clipEnabled = true;
      overlay.clipAxis = item.clipAxis ?? "z";
      overlay.clipValue = value;
    };
    const overlayMap =
      state.overlayVolumes ?? new Map<string, MeshOverlayVolume>();
    state.overlayVolumes = overlayMap;
    const activeIds = new Set(items.map((item) => item.id));

    overlayMap.forEach((overlay, id) => {
      if (activeIds.has(id)) return;
      if (typeof state.renderer.removeVolume === "function") {
        state.renderer.removeVolume(overlay.volume);
      }
      overlay.volume?.delete?.();
      overlay.mapper?.delete?.();
      overlay.ctfun?.delete?.();
      overlay.ofun?.delete?.();
      overlayMap.delete(id);
    });

    const getMaterialPreset = (item: MeshOverlayItem): OverlayMaterialPreset =>
      item.materialPreset ?? "brain";

    const orderedVolumes = items.slice().reverse();

    if (typeof state.renderer.removeVolume === "function") {
      if (state.volume) {
        state.renderer.removeVolume(state.volume);
      }
      overlayMap.forEach((overlay) => {
        state.renderer.removeVolume(overlay.volume);
      });
    }

    if (state.volume && typeof state.renderer.addVolume === "function") {
      state.renderer.addVolume(state.volume);
    }
    for (const item of orderedVolumes) {
      let overlay = overlayMap.get(item.id);
      if (!overlay) {
        try {
          overlay = await state.overlayLoader({
            ...item,
            materialPreset: getMaterialPreset(item),
          });
          overlayMap.set(item.id, overlay);
        } catch (err) {
          console.warn("Overlay volume failed", err);
          continue;
        }
      }
      if (
        overlay.materialPreset !== getMaterialPreset(item) ||
        overlay.opacity !== item.opacity
      ) {
        applyOverlayTransfer(
          overlay.ctfun,
          overlay.ofun,
          overlay.dataRange,
          getMaterialPreset(item),
          item.opacity
        );
        const property = overlay.volume?.getProperty?.();
        property?.setRGBTransferFunction?.(0, overlay.ctfun);
        property?.setScalarOpacity?.(0, overlay.ofun);
        overlay.materialPreset = getMaterialPreset(item);
        overlay.opacity = item.opacity;
      }
      applyOverlayTransform(overlay, item);
      applyOverlayClip(overlay, item);
      if (typeof overlay.volume?.setVisibility === "function") {
        overlay.volume.setVisibility(item.visible);
      }
      overlay.visible = item.visible;
      overlay.layer = "overlay";
      if (typeof state.renderer.addVolume === "function") {
        state.renderer.addVolume(overlay.volume);
      }
    }
    if (!state.volume && typeof state.renderer.resetCamera === "function") {
      state.renderer.resetCamera();
    }
    state.renderWindow.render();
  }, [applyOverlayTransfer]);

  const syncMeshOverlayMeshes = useCallback(async () => {
    const state = meshStateRef.current;
    if (!state?.three || !state?.plyLoader) return;
    const orderedItems = meshOverlayItemsRef.current.filter(
      (item) => item.renderMode === "mesh"
    );
    const overlayOrderMap = new Map<string, number>();
    orderedItems.forEach((item, index) => {
      overlayOrderMap.set(item.id, index);
    });
    const getStackOrder = (item: MeshOverlayItem) => {
      const index = overlayOrderMap.get(item.id) ?? 0;
      return {
        isOverlay: true,
        rank: Math.max(1, orderedItems.length - index),
      };
    };
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const normalizeVector = (
      value: MeshOverlayItem["position"] | MeshOverlayItem["rotation"]
    ): [number, number, number] => {
      if (Array.isArray(value) && value.length === 3) {
        return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
      }
      return [0, 0, 0];
    };
    const applyClip = (
      material: any,
      bounds: { min: [number, number, number]; max: [number, number, number] },
      item: MeshOverlayItem
    ) => {
      const enabled = item.clipEnabled ?? false;
      if (!enabled) {
        material.clippingPlanes = [];
        material.needsUpdate = true;
        return;
      }
      const axis = item.clipAxis ?? "z";
      const axisIndex = axis === "x" ? 0 : axis === "y" ? 1 : 2;
      const value = Math.max(0, Math.min(item.clipValue ?? 0.5, 1));
      const min = bounds.min[axisIndex];
      const max = bounds.max[axisIndex];
      const planeValue = min + (max - min) * value;
      const normal =
        axis === "x"
          ? new state.three.Vector3(1, 0, 0)
          : axis === "y"
            ? new state.three.Vector3(0, 1, 0)
            : new state.three.Vector3(0, 0, 1);
      const point = new state.three.Vector3(
        axis === "x" ? planeValue : 0,
        axis === "y" ? planeValue : 0,
        axis === "z" ? planeValue : 0
      );
      const plane = new state.three.Plane();
      plane.setFromNormalAndCoplanarPoint(normal, point);
      material.clippingPlanes = [plane];
      material.needsUpdate = true;
    };
    const applyTransform = (
      mesh: any,
      item: MeshOverlayItem,
      direction?: [number, number, number]
    ) => {
      const position = normalizeVector(item.position);
      const rotation = normalizeVector(item.rotation);
      const explodeEnabled = item.explodeEnabled ?? false;
      const explodeDistance =
        (item.explodeDistance ?? 0) * Math.max(1, state.maxDim ?? 1);
      const dir = direction ?? ([0, 0, 1] as [number, number, number]);
      const finalPosition = explodeEnabled
        ? [
            position[0] + dir[0] * explodeDistance,
            position[1] + dir[1] * explodeDistance,
            position[2] + dir[2] * explodeDistance,
          ]
        : position;
      mesh.position.set(finalPosition[0], finalPosition[1], finalPosition[2]);
      mesh.rotation.set(
        toRadians(rotation[0]),
        toRadians(rotation[1]),
        toRadians(rotation[2])
      );
      return { position, rotation, finalPosition };
    };
    const items = meshOverlayItemsRef.current.filter(
      (item) => item.renderMode === "mesh"
    );
    const syncId = (meshOverlayMeshSyncRef.current += 1);

    if (!state.overlayStackGroup) {
      state.overlayStackGroup = new state.three.Group();
      state.overlayStackGroup.name = "overlayStackGroup";
      state.scene.add(state.overlayStackGroup);
    }
    if (!state.overlayStackMeshes) {
      state.overlayStackMeshes = new Map();
    }

    const overlayGroup = state.overlayStackGroup;
    const overlayMap = state.overlayStackMeshes;
    const activeIds = new Set(items.map((item) => item.id));

    overlayMap.forEach((entry, id) => {
      if (activeIds.has(id)) return;
      overlayGroup.remove(entry.mesh);
      entry.mesh.geometry?.dispose?.();
      entry.material.dispose?.();
      overlayMap.delete(id);
    });

    for (const item of items) {
      if (meshOverlayMeshSyncRef.current !== syncId) return;
      const existing = overlayMap.get(item.id);
      const needsReload =
        !existing ||
        existing.path !== item.path ||
        existing.iso !== meshOverlayIso ||
        existing.step !== meshOverlayStep ||
        existing.channel !== viewerChannel;

      if (needsReload) {
        if (existing) {
          overlayGroup.remove(existing.mesh);
          existing.mesh.geometry?.dispose?.();
          existing.material.dispose?.();
          overlayMap.delete(item.id);
        }
        try {
          const url = buildMeshUrl(
            item.path,
            meshOverlayIso,
            meshOverlayStep,
            viewerChannel
          );
          if (!url) continue;
          const response = await apiFetch(url);
          if (!response.ok) {
            throw new Error(
              `Overlay mesh download failed (${response.status})`
            );
          }
          const buffer = await response.arrayBuffer();
          if (meshOverlayMeshSyncRef.current !== syncId) return;
          const loader = new state.plyLoader();
          const rawGeometry = loader.parse(buffer);
          const geometry = rawGeometry.index
            ? rawGeometry.toNonIndexed()
            : rawGeometry;
          geometry.computeVertexNormals();
          geometry.computeBoundingBox();
          const overlayBounds = geometry.boundingBox
            ? geometry.boundingBox.clone()
            : new state.three.Box3().setFromBufferAttribute(
                geometry.attributes.position
              );
          const overlayCenter = overlayBounds.getCenter(
            new state.three.Vector3()
          );
          const directionVec = overlayCenter.clone();
          if (directionVec.length() < 0.0001) {
            directionVec.set(0, 0, 1);
          } else {
            directionVec.normalize();
          }
          geometry.translate(
            -overlayCenter.x,
            -overlayCenter.y,
            -overlayCenter.z
          );
          geometry.computeBoundingBox();
          const overlayBoundsFinal = geometry.boundingBox
            ? geometry.boundingBox.clone()
            : new state.three.Box3().setFromBufferAttribute(
                geometry.attributes.position
              );
          const overlayBoundsPayload = {
            min: [
              overlayBoundsFinal.min.x,
              overlayBoundsFinal.min.y,
              overlayBoundsFinal.min.z,
            ] as [number, number, number],
            max: [
              overlayBoundsFinal.max.x,
              overlayBoundsFinal.max.y,
              overlayBoundsFinal.max.z,
            ] as [number, number, number],
          };
          const preset = MESH_MATERIAL_PRESETS[item.materialPreset ?? "brain"];
          const color = new state.three.Color(preset.color);
          const emissive = new state.three.Color(preset.emissive ?? 0x000000);
          const { isOverlay, rank } = getStackOrder(item);
          const meshOpacityValue = Math.max(0.1, Math.min(1, item.opacity));
          const baseTransmission = preset.transmission ?? 0;
          const transmission = meshVolumeEnabled
            ? baseTransmission * 0.35
            : baseTransmission;
          const transparent = meshOpacityValue < 1 || transmission > 0;
          const material = new state.three.MeshPhysicalMaterial({
            color,
            emissive,
            roughness: preset.roughness,
            metalness: preset.metalness,
            clearcoat: preset.clearcoat ?? 0,
            clearcoatRoughness: preset.clearcoatRoughness ?? 0,
            transmission,
            thickness: preset.thickness ?? 0,
            ior: preset.ior ?? 1.5,
            sheen: preset.sheen ?? 0,
            sheenColor: new state.three.Color(preset.sheenColor ?? 0x000000),
            transparent,
            opacity: meshOpacityValue,
            polygonOffset: true,
            polygonOffsetFactor: isOverlay ? -1 : 1,
            polygonOffsetUnits: isOverlay ? -1 : 1,
            side: state.three.DoubleSide,
          });
          const mesh = new state.three.Mesh(geometry, material);
          mesh.renderOrder = isOverlay ? 10 + rank : -10 - rank;
          mesh.visible = item.visible;
          mesh.frustumCulled = false;
          const { position, rotation } = applyTransform(mesh, item, [
            directionVec.x,
            directionVec.y,
            directionVec.z,
          ]);
          applyClip(material, overlayBoundsPayload, item);
          overlayGroup.add(mesh);
          overlayMap.set(item.id, {
            mesh,
            material,
            path: item.path,
            materialPreset: item.materialPreset ?? "brain",
            opacity: item.opacity,
            visible: item.visible,
            iso: meshOverlayIso,
            step: meshOverlayStep,
            channel: viewerChannel,
            layer: "overlay",
            position,
            rotation,
            direction: [directionVec.x, directionVec.y, directionVec.z],
            clipEnabled: item.clipEnabled ?? false,
            clipAxis: item.clipAxis ?? "z",
            clipValue: item.clipValue ?? 0.5,
            explodeEnabled: item.explodeEnabled ?? false,
            explodeDistance: item.explodeDistance ?? 0.25,
          });
        } catch (err) {
          console.warn("Overlay mesh load failed", err);
        }
        continue;
      }

      if (existing) {
        if (
          existing.materialPreset !== (item.materialPreset ?? "brain") ||
          existing.opacity !== item.opacity
        ) {
          const preset = MESH_MATERIAL_PRESETS[item.materialPreset ?? "brain"];
          const color = new state.three.Color(preset.color);
          const emissive = new state.three.Color(preset.emissive ?? 0x000000);
          existing.material.color.copy(color);
          existing.material.emissive.copy(emissive);
          const meshOpacityValue = Math.max(0.1, Math.min(1, item.opacity));
          const baseTransmission = preset.transmission ?? 0;
          const transmission = meshVolumeEnabled
            ? baseTransmission * 0.35
            : baseTransmission;
          existing.material.roughness = preset.roughness;
          existing.material.metalness = preset.metalness;
          existing.material.clearcoat = preset.clearcoat ?? 0;
          existing.material.clearcoatRoughness = preset.clearcoatRoughness ?? 0;
          existing.material.transmission = transmission;
          existing.material.thickness = preset.thickness ?? 0;
          existing.material.ior = preset.ior ?? 1.5;
          existing.material.sheen = preset.sheen ?? 0;
          existing.material.sheenColor = new state.three.Color(
            preset.sheenColor ?? 0x000000
          );
          existing.material.opacity = meshOpacityValue;
          existing.material.transparent =
            meshOpacityValue < 1 || transmission > 0;
          existing.material.needsUpdate = true;
          existing.materialPreset = item.materialPreset ?? "brain";
          existing.opacity = item.opacity;
        }
        const { rank } = getStackOrder(item);
        const nextRenderOrder = 10 + rank;
        if (existing.mesh.renderOrder !== nextRenderOrder) {
          existing.mesh.renderOrder = nextRenderOrder;
        }
        const direction = existing.direction ?? [0, 0, 1];
        const { position, rotation } = applyTransform(
          existing.mesh,
          item,
          direction
        );
        existing.position = position;
        existing.rotation = rotation;
        existing.explodeEnabled = item.explodeEnabled ?? false;
        existing.explodeDistance = item.explodeDistance ?? 0.25;
        const geometryBounds = existing.mesh.geometry?.boundingBox
          ? existing.mesh.geometry.boundingBox
          : null;
        if (geometryBounds) {
          applyClip(
            existing.material,
            {
              min: [
                geometryBounds.min.x,
                geometryBounds.min.y,
                geometryBounds.min.z,
              ],
              max: [
                geometryBounds.max.x,
                geometryBounds.max.y,
                geometryBounds.max.z,
              ],
            },
            item
          );
          existing.clipEnabled = item.clipEnabled ?? false;
          existing.clipAxis = item.clipAxis ?? "z";
          existing.clipValue = item.clipValue ?? 0.5;
        }
        if (existing.visible !== item.visible) {
          existing.mesh.visible = item.visible;
          existing.visible = item.visible;
        }
      }
    }
  }, [
    apiFetch,
    buildMeshUrl,
    meshOverlayIso,
    meshOverlayStep,
    viewerChannel,
  ]);

  const clearMeshSelection = useCallback(() => {
    const state = meshStateRef.current;
    if (!state?.selection) {
      setMeshSelectionCount(0);
      setMeshPickedLabel("");
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
    setMeshPickedLabel("");
  }, []);

  const getAnatomyLabel = useCallback(
    (partIndex: number) => {
      if (!meshAnatomyEnabled) return "";
      const preset = MESH_ANATOMY_PRESETS[meshAnatomyPreset] ??
        MESH_ANATOMY_PRESETS.brain;
      if (!preset.length) return "";
      return preset[partIndex % preset.length];
    },
    [meshAnatomyEnabled, meshAnatomyPreset]
  );

  const buildMeshPartLabel = useCallback((partIndex: number) => {
    const state = meshStateRef.current;
    if (!state) return `Part ${partIndex + 1}`;
    const part = state.meshParts[partIndex];
    if (!part) return `Part ${partIndex + 1}`;
    const [minX, minY, minZ] = state.bounds.min;
    const [maxX, maxY, maxZ] = state.bounds.max;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const sizeX = Math.max(0.0001, maxX - minX);
    const sizeY = Math.max(0.0001, maxY - minY);
    const sizeZ = Math.max(0.0001, maxZ - minZ);
    const dx = (part.center[0] - centerX) / sizeX;
    const dy = (part.center[1] - centerY) / sizeY;
    const dz = (part.center[2] - centerZ) / sizeZ;
    const regionParts: string[] = [];
    const threshold = 0.18;
    if (Math.abs(dx) >= threshold) {
      regionParts.push(dx > 0 ? "Right" : "Left");
    }
    if (Math.abs(dy) >= threshold) {
      regionParts.push(dy > 0 ? "Anterior" : "Posterior");
    }
    if (Math.abs(dz) >= threshold) {
      regionParts.push(dz > 0 ? "Superior" : "Inferior");
    }
    const region = regionParts.length ? regionParts.join(" / ") : "Central";
    const anatomyLabel = getAnatomyLabel(partIndex);
    const labelBase =
      anatomyLabel.length > 0
        ? anatomyLabel
        : state.meshParts.length > 1
          ? `Part ${partIndex + 1}`
          : "Mesh";
    return `${labelBase} \u00b7 ${region}`;
  }, [getAnatomyLabel]);

  const clearMeshLabel = useCallback(() => {
    const state = meshStateRef.current;
    if (!state) return;
    if (state.labelLine) {
      state.labelLine.removeFromParent();
      state.labelLine.geometry?.dispose?.();
      state.labelLine.material?.dispose?.();
      state.labelLine = undefined;
    }
    if (state.labelSprite) {
      state.labelSprite.removeFromParent();
      const material = state.labelSprite.material as any;
      if (material?.map) {
        material.map.dispose?.();
      }
      material?.dispose?.();
      state.labelSprite = undefined;
    }
    if (state.labelGroup) {
      state.labelGroup.removeFromParent();
      state.labelGroup = undefined;
    }
    state.labelPartIndex = undefined;
    setMeshPickedLabel("");
  }, []);

  const updateMeshLabelPosition = useCallback(() => {
    const state = meshStateRef.current;
    if (!state || state.labelPartIndex == null) return;
    const part = state.meshParts[state.labelPartIndex];
    if (!part || !state.labelLine || !state.labelSprite) return;
    const { three: THREE } = state;
    const anchor = new THREE.Vector3(
      part.center[0],
      part.center[1],
      part.center[2]
    ).add(part.mesh.position);
    const offsetDistance = state.maxDim * 0.65;
    const labelPos = new THREE.Vector3(
      part.direction[0],
      part.direction[1],
      part.direction[2]
    )
      .multiplyScalar(offsetDistance)
      .add(anchor);

    const positions = new Float32Array([
      anchor.x,
      anchor.y,
      anchor.z,
      labelPos.x,
      labelPos.y,
      labelPos.z,
    ]);
    state.labelLine.geometry?.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    state.labelLine.geometry?.computeBoundingSphere?.();
    state.labelSprite.position.copy(labelPos);
  }, []);

  const disposeMeshSignals = useCallback((state: MeshViewerState) => {
    if (!state.signalState) return;
    const { overlays, material } = state.signalState;
    overlays.forEach((overlay) => {
      overlay.mesh.removeFromParent();
    });
    material.dispose();
    state.signalState = undefined;
  }, []);

  const createMeshSignals = useCallback((state: MeshViewerState) => {
    const { three: THREE, meshGroup, meshParts } = state;
    const targetId = meshSignalTargetIdRef.current;
    const overlayTarget =
      targetId !== "base"
        ? state.overlayStackMeshes?.get(targetId)?.mesh
        : null;
    const targetMeshes =
      overlayTarget && overlayTarget.geometry
        ? [overlayTarget]
        : meshParts.map((part) => part.mesh);
    if (!targetMeshes.length) return;

    const worldBounds = new THREE.Box3().setFromObject(meshGroup);
    const size = new THREE.Vector3();
    worldBounds.getSize(size);
    const axisIndex =
      size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2;
    const flowAxis = new THREE.Vector3(
      axisIndex === 0 ? 1 : 0,
      axisIndex === 1 ? 1 : 0,
      axisIndex === 2 ? 1 : 0
    );

    const uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: meshSignalSpeedRef.current },
      uColor: { value: new THREE.Color(0xf43f5e) },
      uGlowColor: { value: new THREE.Color(0xf43f5e) },
      uOpacity: { value: 0.7 },
      uGlowBoost: { value: 2.1 },
      uAxis: { value: flowAxis.normalize() },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      vertexShader: `
        uniform vec3 uAxis;
        varying float vFlow;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
          vec3 transformed = position;
          vFlow = dot(transformed, normalize(uAxis));
          vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
          vWorldPos = worldPos.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uSpeed;
        uniform vec3 uColor;
        uniform vec3 uGlowColor;
        uniform float uOpacity;
        uniform float uGlowBoost;
        varying float vFlow;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
          float flowWave = 0.5 + 0.5 * sin(vFlow * 3.2 - uTime * uSpeed * 1.6);
          float surfaceWave = 0.5 + 0.5 * sin(
            (vWorldPos.x * 0.7 + vWorldPos.y * 0.5 + vWorldPos.z * 0.6) +
            uTime * uSpeed * 0.9
          );
          float ripple = 0.5 + 0.5 * sin(
            (vWorldPos.x * 1.1 - vWorldPos.y * 0.8 + vWorldPos.z * 0.9) +
            uTime * uSpeed * 1.4
          );
          float swirl = 0.5 + 0.5 * cos(
            (vWorldPos.x * 0.4 + vWorldPos.y * 0.6 - vWorldPos.z * 0.5) -
            uTime * uSpeed * 1.1
          );
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0), 1.0);
          float flowField = mix(flowWave, surfaceWave, 0.45);
          flowField = mix(flowField, ripple, 0.35);
          flowField = mix(flowField, swirl, 0.25);
          float intensity = smoothstep(0.15, 0.95, flowField);
          float spec = pow(max(dot(normalize(vWorldNormal), viewDir), 0.0), 6.0);
          float rim = pow(fresnel, 1.5);
          float glare = smoothstep(0.6, 1.0, spec) * (0.6 + 0.4 * flowWave);
          float alpha = uOpacity * (0.3 + 0.45 * intensity + 0.45 * spec) * (0.3 + 0.85 * fresnel);
          vec3 baseColor = mix(uColor * 0.75, uGlowColor, 0.35 + 0.45 * intensity);
          vec3 finalColor = baseColor * (1.05 + rim * uGlowBoost) + uGlowColor * spec * 1.1 + uGlowColor * glare * 0.7;
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
    });

    const overlays: Array<{ mesh: any }> = [];
    targetMeshes.forEach((sourceMesh) => {
      if (!sourceMesh?.geometry) return;
      const overlay = new THREE.Mesh(sourceMesh.geometry, material);
      overlay.frustumCulled = false;
      overlay.renderOrder = 2;
      overlay.userData.meshSignalOverlay = true;
      sourceMesh.add(overlay);
      overlays.push({ mesh: overlay });
    });
    overlays.forEach((overlay) => {
      overlay.mesh.visible = meshSignalEnabledRef.current;
    });
    state.signalState = {
      material,
      uniforms,
      overlays,
      targetId,
    };
  }, []);

  const updateMeshSignals = useCallback((delta: number, now: number) => {
    const state = meshStateRef.current;
    if (!state?.signalState) return;
    if (!meshSignalEnabledRef.current) {
      state.signalState.overlays.forEach((overlay) => {
        overlay.mesh.visible = false;
      });
      return;
    }
    const { material, uniforms } = state.signalState;
    state.signalState.overlays.forEach((overlay) => {
      overlay.mesh.visible = true;
    });
    uniforms.uTime.value += delta;
    uniforms.uSpeed.value = meshSignalSpeedRef.current;
    uniforms.uOpacity.value = 0.45 + 0.15 * Math.sin(now * 1.1);
    material.needsUpdate = false;
  }, []);

  useEffect(() => {
    meshSignalSpeedRef.current = meshSignalSpeed;
  }, [meshSignalSpeed]);

  useEffect(() => {
    meshSignalEnabledRef.current = meshSignalEnabled;
    const state = meshStateRef.current;
    if (!state) return;
    if (meshSignalEnabled) {
      if (!state.signalState) {
        createMeshSignals(state);
      } else {
        state.signalState.overlays.forEach((overlay) => {
          overlay.mesh.visible = true;
        });
      }
    } else if (state.signalState) {
      state.signalState.overlays.forEach((overlay) => {
        overlay.mesh.visible = false;
      });
    }
  }, [meshSignalEnabled, createMeshSignals]);

  useEffect(() => {
    meshSignalTargetIdRef.current = meshSignalTargetId;
    if (!meshSignalEnabled) return;
    const state = meshStateRef.current;
    if (!state) return;
    disposeMeshSignals(state);
    createMeshSignals(state);
  }, [meshSignalTargetId, meshSignalEnabled, createMeshSignals, disposeMeshSignals]);

  useEffect(() => {
    if (meshSignalTargetId === "base") return;
    const overlayExists = meshOverlayItems.some(
      (item) => item.id === meshSignalTargetId && item.renderMode === "mesh"
    );
    const workspaceExists = workspaceUploads.some(
      (item) => item.path === meshSignalTargetId
    );
    if (!overlayExists && !workspaceExists) {
      setMeshSignalTargetId("base");
    }
  }, [meshOverlayItems, meshSignalTargetId, workspaceUploads]);

  const createMeshLabel = useCallback(
    (partIndex: number) => {
      const state = meshStateRef.current;
      if (!state) return;
      if (!meshLabelEnabled) return;
      const part = state.meshParts[partIndex];
      if (!part) return;
      const { three: THREE, scene } = state;
      const labelText = buildMeshPartLabel(partIndex);
      clearMeshLabel();

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const paddingX = 32;
      const paddingY = 18;
      const fontSize = 30;
      const notch = 12;
      ctx.font = `600 ${fontSize}px "Space Grotesk", sans-serif`;
      const metrics = ctx.measureText(labelText);
      const textWidth = Math.ceil(metrics.width);
      const width = textWidth + paddingX * 2 + notch;
      const height = fontSize + paddingY * 2;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.ceil(width * ratio);
      canvas.height = Math.ceil(height * ratio);
      ctx.scale(ratio, ratio);
      ctx.font = `600 ${fontSize}px "Space Grotesk", sans-serif`;
      ctx.shadowColor = "rgba(8, 12, 20, 0.55)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "rgba(10, 16, 28, 0.92)");
      gradient.addColorStop(1, "rgba(18, 28, 44, 0.92)");
      ctx.fillStyle = gradient;
      ctx.strokeStyle = "rgba(52, 211, 153, 0.85)";
      ctx.lineWidth = 2;
      const radius = 14;
      ctx.beginPath();
      ctx.moveTo(notch + radius, 0);
      ctx.lineTo(width - radius, 0);
      ctx.quadraticCurveTo(width, 0, width, radius);
      ctx.lineTo(width, height - radius);
      ctx.quadraticCurveTo(width, height, width - radius, height);
      ctx.lineTo(notch + radius, height);
      ctx.quadraticCurveTo(notch, height, notch, height - radius);
      ctx.lineTo(notch, height / 2 + 10);
      ctx.lineTo(0, height / 2);
      ctx.lineTo(notch, height / 2 - 10);
      ctx.lineTo(notch, radius);
      ctx.quadraticCurveTo(notch, 0, notch + radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "rgba(52, 211, 153, 0.9)";
      ctx.fillRect(notch + radius, 3, width - notch - radius * 2, 2);
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(labelText, paddingX + notch, paddingY + fontSize * 0.8);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      const scaleBase = state.maxDim * 0.2;
      const aspect = width / height;
      sprite.scale.set(scaleBase * aspect, scaleBase, 1);
      sprite.center.set(0, 0.5);

      const lineMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(0x34d399),
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      });
      const lineGeometry = new THREE.BufferGeometry();
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.renderOrder = 5;
      sprite.renderOrder = 6;

      const labelGroup = new THREE.Group();
      labelGroup.add(line);
      labelGroup.add(sprite);
      scene.add(labelGroup);

      state.labelGroup = labelGroup;
      state.labelLine = line;
      state.labelSprite = sprite;
      state.labelPartIndex = partIndex;
      setMeshPickedLabel(labelText);
      updateMeshLabelPosition();
    },
    [
      buildMeshPartLabel,
      clearMeshLabel,
      meshLabelEnabled,
      updateMeshLabelPosition,
    ]
  );

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
      setMeshPickedLabel(buildMeshPartLabel(partIndex));
    },
    [buildMeshPartLabel]
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

  useEffect(() => {
    if (!meshLabelEnabled) {
      clearMeshLabel();
    }
  }, [meshLabelEnabled, clearMeshLabel]);

  useEffect(() => {
    const state = meshStateRef.current;
    if (!meshLabelEnabled || state?.labelPartIndex == null) return;
    createMeshLabel(state.labelPartIndex);
  }, [meshAnatomyEnabled, meshAnatomyPreset, meshLabelEnabled, createMeshLabel]);

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

        renderer.setBackground([0.97, 0.98, 1]);

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
        volume.setVisibility(workspaceItemVisibleRef.current);
        if (typeof volume.setPosition === "function") {
          const { position } = workspaceTransformRef.current;
          volume.setPosition(position[0], position[1], position[2]);
        }
        if (typeof volume.setOrientation === "function") {
          const { rotation } = workspaceTransformRef.current;
          volume.setOrientation(rotation[0], rotation[1], rotation[2]);
        }

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
          const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
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
    viewerMountKey,
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
    setMeshLoading(false);

    const container = meshViewerRef.current;
    container.replaceChildren();
    const shell = document.createElement("div");
    shell.className = "mesh-hybrid-shell";
    const meshLayer = document.createElement("div");
    meshLayer.className = "mesh-hybrid-layer mesh-hybrid-layer-mesh";
    let volumeLayer: HTMLDivElement | null = null;
    if (meshVolumeEnabled) {
      volumeLayer = document.createElement("div");
      volumeLayer.className = "mesh-hybrid-layer mesh-hybrid-layer-volume";
      shell.appendChild(volumeLayer);
    }
    shell.appendChild(meshLayer);
    container.appendChild(shell);

    const initMeshViewer = async () => {
      try {
        const THREE = await import("three");
        const controlsModule = await import(
          "three/addons/controls/OrbitControls.js"
        );
        const loaderModule = await import(
          "three/addons/loaders/PLYLoader.js"
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
        const maxDpr = 1.25;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
        const hasVolumeUnderlay = Boolean(volumeLayer);
        renderer.setClearColor(0x0b0b0b, hasVolumeUnderlay ? 0 : 1);
        renderer.localClippingEnabled = true;
        meshLayer.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = hasVolumeUnderlay ? null : new THREE.Color(0x0b0b0b);

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

        let meshVolumeResize: (() => void) | null = null;
        let meshVolumeCleanup: (() => void) | null = null;
        if (volumeLayer) {
          const initMeshVolumeUnderlay = async () => {
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
            const niftiModule = await import("nifti-reader-js");

            if (cancelled || !volumeLayer) return null;

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
            openGLRenderWindow.setContainer(volumeLayer);
            renderWindow.addView(openGLRenderWindow);

            const interactor = vtkRenderWindowInteractor.newInstance();
            interactor.setView(openGLRenderWindow);
            interactor.setInteractorStyle(
              vtkInteractorStyleTrackballCamera.newInstance()
            );
            interactor.initialize();

            renderer.setBackground([0.05, 0.06, 0.08]);

            const toArrayBuffer = (data: ArrayBufferLike): ArrayBuffer => {
              if (data instanceof ArrayBuffer) return data;
              return new Uint8Array(data).slice().buffer;
            };
            const parseNiftiBuffer = (sourceBuffer: ArrayBuffer) => {
              let buffer = sourceBuffer;
              if (nifti.isCompressed(buffer)) {
                buffer = toArrayBuffer(
                  nifti.decompress(buffer) as ArrayBufferLike
                );
              }
              if (!nifti.isNIFTI(buffer)) {
                throw new Error("Unsupported volume file format.");
              }
              const header = nifti.readHeader(buffer);
              const image = nifti.readImage(header, buffer);
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
              const floatArray = new Float32Array(sliced.length);
              for (let i = 0; i < sliced.length; i += 1) {
                const value = sliced[i] as number | bigint;
                const numeric =
                  typeof value === "bigint" ? Number(value) : value;
                floatArray[i] = numeric * slope + intercept;
              }
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
              const origin: [number, number, number] = [
                -(dimensions[0] * spacing[0]) / 2,
                -(dimensions[1] * spacing[1]) / 2,
                -(dimensions[2] * spacing[2]) / 2,
              ];
              imageData.setOrigin(origin);
              const scalars = vtkDataArray.newInstance({
                name: "Scalars",
                numberOfComponents: 1,
                values: floatArray,
              });
              imageData.getPointData().setScalars(scalars);
              const dataRange = scalars.getRange();
              return { imageData, dataRange, dimensions, spacing, origin };
            };

            const createOverlayVolume = async (item: MeshOverlayItem) => {
              const response = await apiFetch(
                buildVolumeFileUrlFor(item.path, 0)
              );
              if (!response.ok) {
                throw new Error(
                  `Overlay volume download failed (${response.status})`
                );
              }
              const buffer = await response.arrayBuffer();
              const parsed = parseNiftiBuffer(buffer);
              const volumeMapper = vtkVolumeMapper.newInstance();
              volumeMapper.setSampleDistance(1.1);
              volumeMapper.setInputData(parsed.imageData);
              const volume = vtkVolume.newInstance();
              volume.setMapper(volumeMapper);
              volume.setVisibility(workspaceItemVisibleRef.current);
              if (typeof volume.setPosition === "function") {
                const { position } = workspaceTransformRef.current;
                volume.setPosition(position[0], position[1], position[2]);
              }
              if (typeof volume.setOrientation === "function") {
                const { rotation } = workspaceTransformRef.current;
                volume.setOrientation(rotation[0], rotation[1], rotation[2]);
              }
              const ctfun = vtkColorTransferFunction.newInstance();
              const ofun = vtkPiecewiseFunction.newInstance();
              applyOverlayTransfer(
                ctfun,
                ofun,
                parsed.dataRange,
                item.materialPreset ?? "brain",
                item.opacity
              );
              const property = volume.getProperty();
              property.setRGBTransferFunction(0, ctfun);
              property.setScalarOpacity(0, ofun);
              property.setInterpolationTypeToLinear();
              property.setShade(true);
              property.setAmbient(0.12);
              property.setDiffuse(0.6);
              property.setSpecular(0.12);
              property.setScalarOpacityUnitDistance(0, 0.9);
              volume.setVisibility(item.visible);
              return {
                id: item.id,
                path: item.path,
                volume,
                mapper: volumeMapper,
                ctfun,
                ofun,
                dataRange: parsed.dataRange,
                dimensions: parsed.dimensions,
                spacing: parsed.spacing,
                origin: parsed.origin,
                materialPreset: item.materialPreset ?? "brain",
                opacity: item.opacity,
                visible: item.visible,
                layer: item.layer ?? "overlay",
                position: item.position ?? [0, 0, 0],
                rotation: item.rotation ?? [0, 0, 0],
                clipEnabled: item.clipEnabled ?? false,
                clipAxis: item.clipAxis ?? "z",
                clipValue: item.clipValue ?? 0,
                clipPlane: null,
                explodeEnabled: item.explodeEnabled ?? false,
                explodeDistance: item.explodeDistance ?? 0.25,
              } as MeshOverlayVolume;
            };

            let baseVolume: any = null;
            let baseMapper: any = null;
            let baseCtfun: any = null;
            let baseOfun: any = null;
            let baseRange: [number, number] = [0, 1];
            let baseDimensions: [number, number, number] = [1, 1, 1];
            let baseSpacing: [number, number, number] = [1, 1, 1];

            if (meshVolumeEnabled) {
              const response = await apiFetch(buildVolumeFileUrl());
              if (!response.ok) {
                throw new Error(
                  `Volume download failed (${response.status})`
                );
              }
              const arrayBuffer = await response.arrayBuffer();
              const parsed = parseNiftiBuffer(arrayBuffer);
              baseRange = parsed.dataRange;
              baseDimensions = parsed.dimensions;
              baseSpacing = parsed.spacing;
              const volumeMapper = vtkVolumeMapper.newInstance();
              volumeMapper.setSampleDistance(1.2);
              volumeMapper.setInputData(parsed.imageData);
              const volume = vtkVolume.newInstance();
              volume.setMapper(volumeMapper);
              const ctfun = vtkColorTransferFunction.newInstance();
              const ofun = vtkPiecewiseFunction.newInstance();
              const min = parsed.dataRange[0];
              const max = parsed.dataRange[1];
              const range = max - min || 1;
              const opacityScale = Math.max(
                0,
                Math.min(meshVolumeOpacity, 0.8)
              );
              const mid = min + range * 0.5;
              const hi = min + range * 0.85;
              const colorStops =
                VOLUME_COLOR_STOPS[meshVolumeColormap] ??
                VOLUME_COLOR_STOPS.radiance;
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
              property.setAmbient(0.15);
              property.setDiffuse(0.65);
              property.setSpecular(0.2);
              property.setScalarOpacityUnitDistance(0, 0.9);
              renderer.addVolume(volume);
              renderer.resetCamera();
              baseVolume = volume;
              baseMapper = volumeMapper;
              baseCtfun = ctfun;
              baseOfun = ofun;
            }

            meshVolumeStateRef.current = {
              renderWindow,
              renderer,
              volumeMapper: baseMapper,
              volume: baseVolume,
              ctfun: baseCtfun,
              ofun: baseOfun,
              dataRange: baseRange,
              dimensions: baseDimensions,
              spacing: baseSpacing,
              clipPlane: null,
              overlayVolumes: new Map(),
              overlayLoader: createOverlayVolume,
            };
            if (meshOverlayItemsRef.current.length > 0) {
              void syncMeshOverlayVolumes();
            }

            const resizeVolume = () => {
              const bounds = volumeLayer.getBoundingClientRect();
              const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
              openGLRenderWindow.setSize(
                Math.max(1, Math.floor(bounds.width * dpr)),
                Math.max(1, Math.floor(bounds.height * dpr))
              );
              renderWindow.render();
            };
            resizeVolume();

            const cleanup = () => {
              const current = meshVolumeStateRef.current;
              if (current?.overlayVolumes) {
                current.overlayVolumes.forEach((overlay) => {
                  if (typeof renderer.removeVolume === "function") {
                    renderer.removeVolume(overlay.volume);
                  }
                  overlay.volume?.delete?.();
                  overlay.mapper?.delete?.();
                  overlay.ctfun?.delete?.();
                  overlay.ofun?.delete?.();
                });
                current.overlayVolumes.clear();
              }
              meshVolumeStateRef.current = null;
              try {
                interactor.unbindEvents?.();
                interactor.delete();
                openGLRenderWindow.delete();
                renderer.delete();
                renderWindow.delete();
              } catch {
                // ignore cleanup errors
              }
              volumeLayer.replaceChildren();
            };

            return { resize: resizeVolume, cleanup };
          };

          try {
            const helpers = await initMeshVolumeUnderlay();
            if (helpers) {
              meshVolumeResize = helpers.resize;
              meshVolumeCleanup = helpers.cleanup;
              meshVolumeCleanupRef.current = helpers.cleanup;
            }
          } catch (err) {
            console.warn("Mesh volume underlay failed", err);
          }
        }

        const primaryChannel = meshSource === "mask" ? 0 : viewerChannel;
        if (!cancelled) {
          setMeshLoading(true);
        }
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
        controls.minDistance = maxDim * 0.35;
        controls.maxDistance = maxDim * 12;

        const materialPreset = MESH_MATERIAL_PRESETS[meshMaterialPreset];
        const meshOpacityValue = Math.max(0.1, Math.min(1, meshOpacity));
        const baseTransmission = materialPreset.transmission ?? 0;
        const transmission = meshVolumeEnabled
          ? baseTransmission * 0.35
          : baseTransmission;
        const transparent = meshOpacityValue < 1 || transmission > 0;
        const material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(materialPreset.color),
          roughness: materialPreset.roughness,
          metalness: materialPreset.metalness,
          clearcoat: materialPreset.clearcoat ?? 0,
          clearcoatRoughness: materialPreset.clearcoatRoughness ?? 0,
          transmission,
          thickness: materialPreset.thickness ?? 0,
          ior: materialPreset.ior ?? 1.5,
          sheen: materialPreset.sheen ?? 0,
          sheenColor: new THREE.Color(
            materialPreset.sheenColor ?? 0x000000
          ),
          emissive: new THREE.Color(materialPreset.emissive ?? 0x000000),
          side: THREE.DoubleSide,
          transparent,
          opacity: meshOpacityValue,
        });

        const meshGroup = new THREE.Group();
        meshGroup.visible = workspaceItemVisibleRef.current;
        {
          const { position, rotation } = workspaceTransformRef.current;
          meshGroup.position.set(position[0], position[1], position[2]);
          meshGroup.rotation.set(
            (rotation[0] * Math.PI) / 180,
            (rotation[1] * Math.PI) / 180,
            (rotation[2] * Math.PI) / 180
          );
        }
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
        const snapshot = meshCameraSnapshotRef.current;
        if (snapshot) {
          camera.position.set(
            snapshot.position[0],
            snapshot.position[1],
            snapshot.position[2]
          );
          camera.up.set(snapshot.up[0], snapshot.up[1], snapshot.up[2]);
          controls.target.set(
            snapshot.target[0],
            snapshot.target[1],
            snapshot.target[2]
          );
        } else {
          camera.position.set(0, 0, maxDim * 1.6);
        }
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

        const overlayStackGroup = new THREE.Group();
        overlayStackGroup.name = "overlayStackGroup";
        scene.add(overlayStackGroup);

        meshStateRef.current = {
          three: THREE,
          plyLoader: PLYLoader,
          renderer,
          scene,
          camera,
          controls,
          meshGroup,
          meshParts,
          sourceGeometry,
          material,
          overlayMesh: null,
          overlayMaterial: null,
          overlayStackGroup,
          overlayStackMeshes: new Map(),
          clipPlane: null,
          bounds: boundsPayload,
          centerOffset: [mainCenter.x, mainCenter.y, mainCenter.z],
          maxDim,
          activePartIndex: 0,
        };
        if (meshSignalEnabledRef.current) {
          createMeshSignals(meshStateRef.current);
        }
        setMeshOverlayRevision((value) => value + 1);

        clearMeshSelection();
        setMeshPartCount(meshParts.length);
        setMeshActiveGroup(0);
        setMeshSelectionCount(0);
        setMeshPartOffsets({});
        setMeshPickedLabel("");

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
        const flyForward = new THREE.Vector3();
        const flyRight = new THREE.Vector3();
        const flyUp = new THREE.Vector3();
        const flyDelta = new THREE.Vector3();
        const keyState = {
          w: false,
          a: false,
          s: false,
          d: false,
          q: false,
          e: false,
        };
        const transformState = {
          mode: null as "move" | "rotate" | null,
          axis: null as 0 | 1 | 2 | null,
        };
        let transformPointerId: number | null = null;
        let transformStart = { x: 0, y: 0 };
        let transformBasePosition: [number, number, number] = [0, 0, 0];
        let transformBaseRotation: [number, number, number] = [0, 0, 0];
        let transformTargetId: string | null = null;
        let transformRaf = 0;
        let transformPending: { dx: number; dy: number } | null = null;

        const normalizeTransform = (
          value?: [number, number, number]
        ): [number, number, number] => {
          if (Array.isArray(value) && value.length === 3) {
            return [
              Number(value[0]) || 0,
              Number(value[1]) || 0,
              Number(value[2]) || 0,
            ];
          }
          return [0, 0, 0];
        };

        const applyTransformDelta = (dx: number, dy: number) => {
          if (!transformTargetId || transformState.axis === null) return;
          const axis = transformState.axis;
          const axisDelta =
            axis === 0 ? dx : axis === 1 ? -dy : dx + dy * 0.5;
          if (transformState.mode === "move") {
            const next: [number, number, number] = [
              transformBasePosition[0],
              transformBasePosition[1],
              transformBasePosition[2],
            ];
            const moveScale = Math.max(0.001, maxDim * 0.002);
            next[axis] = transformBasePosition[axis] + axisDelta * moveScale;
            updateMeshOverlayItem(transformTargetId, { position: next });
            return;
          }
          if (transformState.mode === "rotate") {
            const next: [number, number, number] = [
              transformBaseRotation[0],
              transformBaseRotation[1],
              transformBaseRotation[2],
            ];
            const rotateScale = 0.25;
            next[axis] = transformBaseRotation[axis] + axisDelta * rotateScale;
            updateMeshOverlayItem(transformTargetId, { rotation: next });
          }
        };

        const scheduleTransform = (dx: number, dy: number) => {
          transformPending = { dx, dy };
          if (transformRaf) return;
          transformRaf = window.requestAnimationFrame(() => {
            const pending = transformPending;
            if (pending) {
              applyTransformDelta(pending.dx, pending.dy);
            }
            transformPending = null;
            transformRaf = 0;
          });
        };

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
          if (tool === "label") {
            createMeshLabel(partIndex);
            return;
          }
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
          if (
            event.button === 0 &&
            transformState.mode &&
            transformState.axis !== null
          ) {
            const targetId = activeMeshOverlayIdRef.current;
            const targetItem = meshOverlayItemsRef.current.find(
              (item) => item.id === targetId
            );
            if (targetId && targetItem && targetItem.renderMode === "mesh") {
              transformTargetId = targetId;
              transformBasePosition = normalizeTransform(targetItem.position);
              transformBaseRotation = normalizeTransform(targetItem.rotation);
              transformStart = { x: event.clientX, y: event.clientY };
              transformPointerId = event.pointerId;
              controls.enabled = false;
              meshSculptingRef.current = false;
              renderer.domElement.setPointerCapture(event.pointerId);
              renderer.domElement.style.cursor = "grabbing";
              event.preventDefault();
              event.stopImmediatePropagation();
              return;
            }
          }
          if (tool === "orbit") return;
          if (tool === "select" || tool === "label") {
            handlePointer(event);
            return;
          }
          if (!canSculpt || meshExplodeEnabledRef.current) return;
          meshSculptingRef.current = true;
          handlePointer(event);
        };

        const onPointerMove = (event: PointerEvent) => {
          if (transformPointerId !== null) {
            if (event.pointerId !== transformPointerId) return;
            const dx = event.clientX - transformStart.x;
            const dy = event.clientY - transformStart.y;
            scheduleTransform(dx, dy);
            return;
          }
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

        const onPointerUp = (_event: PointerEvent) => {
          meshSculptingRef.current = false;
          meshPendingRef.current = null;
          if (transformPointerId !== null) {
            renderer.domElement.releasePointerCapture(transformPointerId);
            transformPointerId = null;
            transformTargetId = null;
            transformPending = null;
            if (transformRaf) {
              window.cancelAnimationFrame(transformRaf);
              transformRaf = 0;
            }
            renderer.domElement.style.cursor = orbitHoverActive ? "grab" : "";
            controls.enabled = meshToolRef.current === "orbit";
          }
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

        const shouldIgnoreKey = (event: KeyboardEvent) => {
          const target = event.target as HTMLElement | null;
          if (!target) return false;
          const tag = target.tagName;
          return (
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            target.isContentEditable
          );
        };

        const onKeyDown = (event: KeyboardEvent) => {
          if (shouldIgnoreKey(event)) return;
          let handled = true;
          switch (event.code) {
            case "KeyW":
              keyState.w = true;
              break;
            case "KeyA":
              keyState.a = true;
              break;
            case "KeyS":
              keyState.s = true;
              break;
            case "KeyD":
              keyState.d = true;
              break;
            case "KeyQ":
              keyState.q = true;
              break;
            case "KeyE":
              keyState.e = true;
              break;
            case "KeyM":
              transformState.mode = "move";
              break;
            case "KeyR":
              transformState.mode = "rotate";
              break;
            case "KeyX":
              transformState.axis = 0;
              break;
            case "KeyY":
              transformState.axis = 1;
              break;
            case "KeyZ":
              transformState.axis = 2;
              break;
            default:
              handled = false;
              break;
          }
          if (handled) {
            event.preventDefault();
          }
        };

        const onKeyUp = (event: KeyboardEvent) => {
          switch (event.code) {
            case "KeyW":
              keyState.w = false;
              break;
            case "KeyA":
              keyState.a = false;
              break;
            case "KeyS":
              keyState.s = false;
              break;
            case "KeyD":
              keyState.d = false;
              break;
            case "KeyQ":
              keyState.q = false;
              break;
            case "KeyE":
              keyState.e = false;
              break;
            case "KeyM":
              if (transformState.mode === "move") {
                transformState.mode = null;
              }
              break;
            case "KeyR":
              if (transformState.mode === "rotate") {
                transformState.mode = null;
              }
              break;
            case "KeyX":
              if (transformState.axis === 0) {
                transformState.axis = null;
              }
              break;
            case "KeyY":
              if (transformState.axis === 1) {
                transformState.axis = null;
              }
              break;
            case "KeyZ":
              if (transformState.axis === 2) {
                transformState.axis = null;
              }
              break;
            default:
              return;
          }
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
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("pointerup", onPointerUp);

        const resize = () => {
          const bounds = meshLayer.getBoundingClientRect();
          const width = Math.max(1, bounds.width);
          const height = Math.max(1, bounds.height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
          if (meshVolumeResize) {
            meshVolumeResize();
          }
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
        let lastTime = performance.now();
        let lastRenderTime = 0;
        const targetFrameMs = 1000 / 30;
        const idleFrameMs = 1000 / 6;
        const animate = () => {
          animationId = window.requestAnimationFrame(animate);
          if (document.hidden) return;
          const now = performance.now();
          const delta = Math.min(0.05, (now - lastTime) / 1000);
          lastTime = now;

          let hasActivity = false;
          flyDelta.set(0, 0, 0);
          if (
            keyState.w ||
            keyState.a ||
            keyState.s ||
            keyState.d ||
            keyState.q ||
            keyState.e
          ) {
            hasActivity = true;
            camera.getWorldDirection(flyForward);
            flyForward.normalize();
            flyRight.copy(flyForward).cross(camera.up).normalize();
            flyUp.copy(camera.up).normalize();
            const flySpeed = maxDim * 0.8;
            if (keyState.w) flyDelta.add(flyForward);
            if (keyState.s) flyDelta.addScaledVector(flyForward, -1);
            if (keyState.d) flyDelta.add(flyRight);
            if (keyState.a) flyDelta.addScaledVector(flyRight, -1);
            if (keyState.e) flyDelta.add(flyUp);
            if (keyState.q) flyDelta.addScaledVector(flyUp, -1);
            if (flyDelta.lengthSq() > 0) {
              flyDelta.normalize().multiplyScalar(flySpeed * delta);
              camera.position.add(flyDelta);
              controls.target.add(flyDelta);
            }
          }
          if (
            ctrlOrbitActive ||
            orbitOverrideActive ||
            panOverrideActive ||
            meshSculptingRef.current ||
            meshPendingRef.current ||
            transformState.mode ||
            transformPending ||
            transformPointerId !== null
          ) {
            hasActivity = true;
          }
          if (meshSignalEnabledRef.current) {
            hasActivity = true;
            updateMeshSignals(delta, now / 1000);
          }
          const controlsChanged = controls.update();
          if (controlsChanged) {
            hasActivity = true;
          }
          const frameInterval = hasActivity ? targetFrameMs : idleFrameMs;
          if (now - lastRenderTime < frameInterval) return;
          lastRenderTime = now;

          renderer.render(scene, camera);
          if (meshVolumeStateRef.current) {
            const vtkCamera = meshVolumeStateRef.current.renderer.getActiveCamera();
            const target = controls.target;
            vtkCamera.setPosition(
              camera.position.x,
              camera.position.y,
              camera.position.z
            );
            vtkCamera.setFocalPoint(target.x, target.y, target.z);
            vtkCamera.setViewUp(camera.up.x, camera.up.y, camera.up.z);
            if (typeof vtkCamera.setViewAngle === "function") {
              vtkCamera.setViewAngle(camera.fov);
            }
            if (typeof vtkCamera.setClippingRange === "function") {
              vtkCamera.setClippingRange(0.01, maxDim * 12);
            }
            if (
              typeof meshVolumeStateRef.current.renderer.resetCameraClippingRange ===
              "function"
            ) {
              meshVolumeStateRef.current.renderer.resetCameraClippingRange();
            }
            meshVolumeStateRef.current.renderWindow.render();
          }
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
          meshCameraSnapshotRef.current = {
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: [controls.target.x, controls.target.y, controls.target.z],
            up: [camera.up.x, camera.up.y, camera.up.z],
          };
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
          meshGroup.removeFromParent();
          material.dispose();
          const overlayMesh = meshStateRef.current?.overlayMesh;
          const overlayMaterial = meshStateRef.current?.overlayMaterial;
          const overlayStackGroup = meshStateRef.current?.overlayStackGroup;
          const overlayStackMeshes = meshStateRef.current?.overlayStackMeshes;
          const labelGroup = meshStateRef.current?.labelGroup;
          const labelLine = meshStateRef.current?.labelLine;
          const labelSprite = meshStateRef.current?.labelSprite;
          if (overlayMesh) {
            overlayMesh.removeFromParent();
            overlayMesh.geometry?.dispose?.();
          }
          if (overlayMaterial) {
            overlayMaterial.dispose();
          }
          if (overlayStackMeshes) {
            overlayStackMeshes.forEach((entry) => {
              overlayStackGroup?.remove(entry.mesh);
              entry.mesh.geometry?.dispose?.();
              entry.material.dispose?.();
            });
            overlayStackMeshes.clear();
          }
          if (overlayStackGroup) {
            overlayStackGroup.removeFromParent();
          }
          if (labelLine) {
            labelLine.removeFromParent();
            labelLine.geometry?.dispose?.();
            labelLine.material?.dispose?.();
          }
          if (labelSprite) {
            labelSprite.removeFromParent();
            const labelMaterial = labelSprite.material as any;
            if (labelMaterial?.map) {
              labelMaterial.map.dispose?.();
            }
            labelMaterial?.dispose?.();
          }
          if (labelGroup) {
            labelGroup.removeFromParent();
          }
          if (meshStateRef.current?.signalState) {
            disposeMeshSignals(meshStateRef.current);
          }
          renderer.dispose();
          if (meshVolumeCleanup) {
            meshVolumeCleanup();
          } else if (meshVolumeCleanupRef.current) {
            meshVolumeCleanupRef.current();
          }
          meshVolumeCleanupRef.current = null;
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
    meshIso,
    meshStep,
    meshVolumeEnabled,
    meshSource,
    meshMaskAvailable,
    meshMountKey,
    meshRevision,
    buildMeshUrl,
    buildVolumeFileUrl,
    buildVolumeFileUrlFor,
    applyOverlayTransfer,
    syncMeshOverlayVolumes,
    apiFetch,
    isAuthenticated,
  ]);

  useEffect(() => {
    if (viewerMode !== "3d" || viewer3dMode !== "mesh") return;
    const state = meshStateRef.current;
    if (!state) return;
    const overlayPath = meshOverlayPath;
    if (!overlayPath) {
      if (state.overlayMesh) {
        state.overlayMesh.removeFromParent();
        state.overlayMesh.geometry?.dispose?.();
        state.overlayMesh = null;
      }
      if (state.overlayMaterial) {
        state.overlayMaterial.dispose();
        state.overlayMaterial = null;
      }
      return;
    }
    if (!meshOverlayEnabled) {
      if (state.overlayMesh) {
        state.overlayMesh.visible = false;
      }
      return;
    }

    let cancelled = false;
    const targetState = state;
    const loadOverlay = async () => {
      try {
        const { three: THREE, plyLoader } = targetState;
        const overlayResponse = await apiFetch(
          buildMeshUrl(overlayPath, meshOverlayIso, meshOverlayStep, 0, {
            disableVessel: true,
          })
        );
        if (!overlayResponse.ok) {
          throw new Error(
            `Overlay mesh download failed (${overlayResponse.status}).`
          );
        }
        const overlayBuffer = await overlayResponse.arrayBuffer();
        if (cancelled || meshStateRef.current !== targetState) return;

        const loaderCtor =
          plyLoader ??
          ((
            await import("three/examples/jsm/loaders/PLYLoader")
          ) as {
            PLYLoader: new () => { parse: (data: ArrayBuffer) => any };
          }).PLYLoader;
        const loader = new loaderCtor();
        const overlayRaw = loader.parse(overlayBuffer);
        const overlayGeometry = overlayRaw.index
          ? overlayRaw.toNonIndexed()
          : overlayRaw;
        overlayGeometry.computeVertexNormals();
        overlayGeometry.computeBoundingBox();
        const offset = targetState.centerOffset;
        overlayGeometry.translate(-offset[0], -offset[1], -offset[2]);
        overlayGeometry.computeBoundingBox();

        const overlayOpacity = Math.min(
          0.95,
          Math.max(0.15, meshOverlayOpacityRef.current)
        );
        const overlayMaterial = new THREE.MeshPhysicalMaterial({
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
          depthTest: false,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
          side: THREE.DoubleSide,
        });
        const overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
        overlayMesh.renderOrder = 4;
        overlayMesh.frustumCulled = false;
        overlayMesh.visible = meshOverlayEnabled;
        applyOverlayLockTransform(overlayMesh);

        if (targetState.overlayMesh) {
          targetState.overlayMesh.removeFromParent();
          targetState.overlayMesh.geometry?.dispose?.();
        }
        if (targetState.overlayMaterial) {
          targetState.overlayMaterial.dispose();
        }
        targetState.overlayMesh = overlayMesh;
        targetState.overlayMaterial = overlayMaterial;
        targetState.scene.add(overlayMesh);
      } catch (err) {
        console.warn("Overlay mesh load failed", err);
      }
    };

    void loadOverlay();

    return () => {
      cancelled = true;
    };
  }, [
    viewerMode,
    viewer3dMode,
    meshOverlayEnabled,
    meshOverlayPath,
    meshOverlayIso,
    meshOverlayStep,
    meshRevision,
    meshOverlayRevision,
    buildMeshUrl,
    apiFetch,
    applyOverlayLockTransform,
  ]);

  useEffect(() => {
    if (viewerMode !== "3d" || viewer3dMode !== "mesh") return;
    const state = meshStateRef.current;
    if (!state?.overlayMesh) return;
    applyOverlayLockTransform(state.overlayMesh);
  }, [
    viewerMode,
    viewer3dMode,
    meshOverlayItems,
    meshOverlayLockEnabled,
    meshOverlayLockTarget,
    applyOverlayLockTransform,
  ]);

  useEffect(() => {
    if (viewerMode !== "3d" || viewer3dMode !== "mesh") return;
    void syncMeshOverlayVolumes();
  }, [
    viewerMode,
    viewer3dMode,
    meshOverlayItems,
    meshVolumeEnabled,
    meshRevision,
    meshMountKey,
    syncMeshOverlayVolumes,
  ]);

  useEffect(() => {
    if (viewerMode !== "3d" || viewer3dMode !== "mesh") return;
    void syncMeshOverlayMeshes();
  }, [
    viewerMode,
    viewer3dMode,
    meshOverlayItems,
    meshOverlayIso,
    meshOverlayStep,
    viewerChannel,
    meshRevision,
    meshMountKey,
    syncMeshOverlayMeshes,
  ]);

  useEffect(() => {
    const state = meshStateRef.current;
    if (!state) return;
    state.controls.enabled = meshTool === "orbit";
    if (meshTool === "select" || meshTool === "label") {
      meshSculptingRef.current = false;
      meshPendingRef.current = null;
    }
  }, [meshTool]);

  useEffect(() => {
    if (meshCanSculpt) return;
    if (meshTool !== "orbit" && meshTool !== "select" && meshTool !== "label") {
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
    if (state.labelGroup && state.labelPartIndex != null) {
      state.labelGroup.visible =
        !meshIsolateEnabled || state.labelPartIndex === meshActiveGroup;
    }
  }, [meshIsolateEnabled, meshActiveGroup, meshRevision]);

  useEffect(() => {
    const state = meshStateRef.current;
    if (!state) return;
    const preset = MESH_MATERIAL_PRESETS[meshMaterialPreset];
    const material = state.material;
    const meshOpacityValue = Math.max(0.1, Math.min(1, meshOpacity));
    const baseTransmission = preset.transmission ?? 0;
    const transmission = meshVolumeEnabled
      ? baseTransmission * 0.35
      : baseTransmission;
    material.color.setHex(preset.color);
    material.roughness = preset.roughness;
    material.metalness = preset.metalness;
    material.clearcoat = preset.clearcoat ?? 0;
    material.clearcoatRoughness = preset.clearcoatRoughness ?? 0;
    material.transmission = transmission;
    material.thickness = preset.thickness ?? 0;
    material.ior = preset.ior ?? 1.5;
    material.sheen = preset.sheen ?? 0;
    material.sheenColor = new state.three.Color(preset.sheenColor ?? 0x000000);
    material.emissive = new state.three.Color(preset.emissive ?? 0x000000);
    material.opacity = meshOpacityValue;
    material.transparent = meshOpacityValue < 1 || transmission > 0;
    material.needsUpdate = true;
  }, [meshMaterialPreset, meshOpacity, meshVolumeEnabled]);

  useEffect(() => {
    const state = meshStateRef.current;
    if (!state?.overlayMaterial) return;
    const overlayOpacity = Math.min(0.95, Math.max(0.1, meshOverlayOpacity));
    state.overlayMaterial.opacity = overlayOpacity;
    state.overlayMaterial.transparent = overlayOpacity < 1;
    state.overlayMaterial.needsUpdate = true;
    if (state.overlayMesh) {
      state.overlayMesh.visible = meshOverlayEnabled;
    }
  }, [meshOverlayOpacity, meshOverlayEnabled, meshRevision]);

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
    updateMeshLabelPosition();
  }, [
    meshExplodeEnabled,
    meshExplodeDistance,
    meshPartOffsets,
    meshRevision,
    updateMeshLabelPosition,
  ]);

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
      overlayMaterial.clippingPlanes = [];
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
    const state = meshVolumeStateRef.current;
    if (!state || !state.ctfun) return;
    const [min, max] = state.dataRange;
    const range = max - min || 1;
    const stops =
      VOLUME_COLOR_STOPS[meshVolumeColormap] ?? VOLUME_COLOR_STOPS.radiance;
    state.ctfun.removeAllPoints();
    stops.forEach(([stop, color]) => {
      const value = min + range * stop;
      state.ctfun.addRGBPoint(value, color[0], color[1], color[2]);
    });
    state.renderWindow.render();
  }, [meshVolumeColormap]);

  useEffect(() => {
    const state = meshVolumeStateRef.current;
    if (!state || !state.ofun) return;
    const [min, max] = state.dataRange;
    const range = max - min || 1;
    const mid = min + range * 0.5;
    const hi = min + range * 0.85;
    const opacityScale = Math.max(0, Math.min(meshVolumeOpacity, 0.8));
    state.ofun.removeAllPoints();
    state.ofun.addPoint(min, 0.0);
    state.ofun.addPoint(mid, 0.05 * opacityScale);
    state.ofun.addPoint(hi, 0.25 * opacityScale);
    state.ofun.addPoint(max, 0.9 * opacityScale);
    state.renderWindow.render();
  }, [meshVolumeOpacity]);

  useEffect(() => {
    const state = viewer3dStateRef.current;
    if (!state) return;
    state.volumeMapper.removeAllClippingPlanes();
    if (clipEnabled) {
      const vtkPlane = vtkPlaneRef.current;
      if (!vtkPlane) return;
      const plane = state.clipPlane ?? vtkPlane.newInstance();
      let minX = 0;
      let maxX = 0;
      let minY = 0;
      let maxY = 0;
      let minZ = 0;
      let maxZ = 0;
      if (typeof state.volume?.getBounds === "function") {
        const bounds = state.volume.getBounds();
        if (Array.isArray(bounds) && bounds.length >= 6) {
          [minX, maxX, minY, maxY, minZ, maxZ] = bounds;
        }
      }
      if (minX === maxX && minY === maxY && minZ === maxZ) {
        const [dx, dy, dz] = state.dimensions;
        const [sx, sy, sz] = state.spacing;
        const sizeX = dx * sx;
        const sizeY = dy * sy;
        const sizeZ = dz * sz;
        minX = -sizeX / 2;
        minY = -sizeY / 2;
        minZ = -sizeZ / 2;
        maxX = minX + sizeX;
        maxY = minY + sizeY;
        maxZ = minZ + sizeZ;
      }
      const value = Math.max(0, Math.min(clipValue, 1));
      if (clipAxis === "x") {
        plane.setNormal(1, 0, 0);
        plane.setOrigin(minX + (maxX - minX) * value, minY, minZ);
      } else if (clipAxis === "y") {
        plane.setNormal(0, 1, 0);
        plane.setOrigin(minX, minY + (maxY - minY) * value, minZ);
      } else {
        plane.setNormal(0, 0, 1);
        plane.setOrigin(minX, minY, minZ + (maxZ - minZ) * value);
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
    if (lower.endsWith(".dicom")) return "dicom";
    if (lower.endsWith(".zip")) return "zip";
    return "unknown";
  };

  const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
  const normalizeSelectedFiles = useCallback((selected: File[]) => {
    const seen = new Set<string>();
    const accepted: File[] = [];
    const ignoredEmpty: string[] = [];
    const ignoredLarge: string[] = [];
    const ignoredUnknown: string[] = [];
    const ignoredDuplicates: string[] = [];

    selected.forEach((file) => {
      const key = `${file.name}::${file.size}::${file.lastModified}`;
      if (seen.has(key)) {
        ignoredDuplicates.push(file.name);
        return;
      }
      seen.add(key);
      if (file.size === 0) {
        ignoredEmpty.push(file.name);
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        ignoredLarge.push(file.name);
        return;
      }
      const kind = inferFileKind(file.name);
      if (kind === "unknown") {
        ignoredUnknown.push(file.name);
        return;
      }
      accepted.push(file);
    });

    return {
      accepted,
      ignoredEmpty,
      ignoredLarge,
      ignoredUnknown,
      ignoredDuplicates,
    };
  }, []);

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
    if (selectionKinds.includes("zip") && !isWorkspace) {
      return "Zip files must be uploaded one at a time.";
    }
    if (selectionKinds.includes("unknown")) {
      return "Some files have unsupported extensions.";
    }
    if (selectionKinds.length > 1) {
      return "Do not mix NIfTI and DICOM files in the same batch.";
    }
    return "";
  }, [isWorkspace, selectedFileCount, selectionKinds]);

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
    const {
      accepted,
      ignoredEmpty,
      ignoredLarge,
      ignoredUnknown,
      ignoredDuplicates,
    } = normalizeSelectedFiles(selected);
    setFiles(accepted);
    setViewerError("");
    setError("");
    if (!isWorkspace) {
      setUploadResult(null);
      setUploadPreview(null);
      setVolumeInfo(null);
      setJobId("");
      setJobStatus(null);
      setJobResult(null);
      if (workspacePath) {
        setWorkspacePath("");
      }
    }
    if (selected.length > 0) {
      if (ignoredEmpty.length > 0) {
        pushNotice(
          "error",
          "Empty files ignored",
          `${ignoredEmpty.length} file(s) were empty and skipped.`
        );
      }
      if (ignoredLarge.length > 0) {
        pushNotice(
          "error",
          "Files too large",
          `${ignoredLarge.length} file(s) exceeded the 2GB limit and were skipped.`
        );
      }
      if (ignoredUnknown.length > 0) {
        pushNotice(
          "error",
          "Unsupported files",
          `${ignoredUnknown.length} file(s) had unsupported extensions.`
        );
      }
      if (ignoredDuplicates.length > 0) {
        pushNotice(
          "info",
          "Duplicates skipped",
          `${ignoredDuplicates.length} duplicate file(s) were ignored.`
        );
      }
      if (accepted.length > 0) {
        const name =
          accepted.length === 1 ? accepted[0].name : `${accepted.length} files`;
        pushNotice("info", "Scan selected", `${name} ready to upload.`);
      }
    }
    event.currentTarget.value = "";
  };

  const handleUploadDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setUploadDropActive(false);
    const dropped = Array.from(event.dataTransfer.files ?? []);
    const {
      accepted,
      ignoredEmpty,
      ignoredLarge,
      ignoredUnknown,
      ignoredDuplicates,
    } = normalizeSelectedFiles(dropped);
    setFiles(accepted);
    setViewerError("");
    setError("");
    if (!isWorkspace) {
      setUploadResult(null);
      setUploadPreview(null);
      setVolumeInfo(null);
      setJobId("");
      setJobStatus(null);
      setJobResult(null);
      if (workspacePath) {
        setWorkspacePath("");
      }
    }
    if (ignoredEmpty.length > 0) {
      pushNotice(
        "error",
        "Empty files ignored",
        `${ignoredEmpty.length} file(s) were empty and skipped.`
      );
    }
    if (ignoredLarge.length > 0) {
      pushNotice(
        "error",
        "Files too large",
        `${ignoredLarge.length} file(s) exceeded the 2GB limit and were skipped.`
      );
    }
    if (ignoredUnknown.length > 0) {
      pushNotice(
        "error",
        "Unsupported files",
        `${ignoredUnknown.length} file(s) had unsupported extensions.`
      );
    }
    if (ignoredDuplicates.length > 0) {
      pushNotice(
        "info",
        "Duplicates skipped",
        `${ignoredDuplicates.length} duplicate file(s) were ignored.`
      );
    }
    if (accepted.length > 0) {
      const name =
        accepted.length === 1 ? accepted[0].name : `${accepted.length} files`;
      pushNotice("info", "Scan selected", `${name} ready to upload.`);
    }
  };

  const clearOverviewUpload = useCallback(() => {
    if (isWorkspace) return;
    setFiles([]);
    setUploadResult(null);
    setUploadPreview(null);
    setPreviewPath("");
    setVolumeInfo(null);
    setViewerError("");
    setViewerLoading(false);
    setJobId("");
    setJobStatus(null);
    setJobResult(null);
    volumeInfoPathRef.current = "";
    volumeInfoRequestRef.current = "";
    previewPathRef.current = "";
    pushNotice("info", "Upload cleared", "Overview scan state reset.");
  }, [isWorkspace, pushNotice]);

  const uploadMeshOverlayFiles = async (selected: File[]) => {
    if (selected.length === 0) return;
    const remaining = Math.max(
      0,
      MESH_OVERLAY_LIMIT - meshOverlayItemsRef.current.length
    );
    if (remaining <= 0) {
      pushNotice(
        "error",
        "Overlay limit reached",
        `Only ${MESH_OVERLAY_LIMIT} overlay volumes can be active.`
      );
      return;
    }
    const allowed = selected.filter((file) =>
      ["nifti", "zip"].includes(inferFileKind(file.name))
    );
    if (allowed.length === 0) {
      pushNotice(
        "error",
        "Unsupported files",
        "Overlay accepts NIfTI (.nii/.nii.gz) or zip uploads only."
      );
      return;
    }
    const queue = allowed.slice(0, remaining);
    if (!meshVolumeEnabled) {
      setMeshVolumeEnabled(true);
      pushNotice(
        "info",
        "Volume underlay enabled",
        "Overlay volumes require the underlay renderer to be active."
      );
    }
    setMeshOverlayUploading(true);
    try {
      const created: MeshOverlayItem[] = [];
      for (const file of queue) {
        const form = new FormData();
        form.append("file", file);
        const res = await apiFetch(`${API_BASE}/api/uploads`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          throw new Error(`Overlay upload failed (${res.status})`);
        }
        const data = (await res.json()) as UploadResponse;
        const savedPath = "saved_path" in data ? data.saved_path : "";
        if (!savedPath) continue;
        const presetIndex =
          (meshOverlayItemsRef.current.length + created.length) %
          MESH_OVERLAY_MATERIAL_PRESETS.length;
        created.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          path: savedPath,
          label: file.name,
          materialPreset: MESH_OVERLAY_MATERIAL_PRESETS[presetIndex].id,
          opacity: 0.45,
          visible: true,
          renderMode: "volume",
          layer: "overlay",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          clipEnabled: false,
          clipAxis: "z",
          clipValue: 0,
          explodeEnabled: false,
          explodeDistance: 0.25,
        });
      }
      if (created.length > 0) {
        setMeshOverlayItems((prev) => [...created, ...prev]);
        setActiveMeshOverlayId(created[0].id);
        pushNotice(
          "success",
          "Overlay ready",
          `${created.length} volume(s) added to the stack.`
        );
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Overlay upload failed.";
      pushNotice("error", "Overlay upload failed", message);
    } finally {
      setMeshOverlayUploading(false);
      setMeshOverlayFiles([]);
    }
  };

  const handleMeshOverlayFilesChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selected = Array.from(event.target.files ?? []);
    setMeshOverlayFiles(selected);
    void uploadMeshOverlayFiles(selected);
    event.target.value = "";
  };

  const handleMeshOverlayDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setMeshOverlayDropActive(false);
    const dropped = Array.from(event.dataTransfer.files ?? []);
    setMeshOverlayFiles(dropped);
    void uploadMeshOverlayFiles(dropped);
  };

  const updateMeshOverlayItem = (
    id: string,
    patch: Partial<MeshOverlayItem>
  ) => {
    setMeshOverlayItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeMeshOverlayItem = (id: string) => {
    setMeshOverlayItems((prev) => prev.filter((item) => item.id !== id));
  };

  const moveMeshOverlayItem = useCallback(
    (id: string, direction: "up" | "down") => {
      setMeshOverlayItems((prev) => {
        const currentIndex = prev.findIndex((item) => item.id === id);
        if (currentIndex === -1) return prev;
        const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= prev.length) return prev;
        const next = prev.slice();
        const [moved] = next.splice(currentIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    },
    []
  );

  const updateWorkspaceUpload = useCallback(
    (path: string, patch: Partial<WorkspaceUploadItem>) => {
      setWorkspaceUploads((prev) =>
        prev.map((item) => (item.path === path ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const clearWorkspaceUploads = useCallback(() => {
    setWorkspaceUploads([]);
    setWorkspacePath("");
    setActiveWorkspaceIndex(0);
    if (isWorkspace) {
      navigate({ pathname: "/workspace", search: "" }, { replace: true });
    }
  }, [isWorkspace, navigate]);

  const addWorkspaceUploadToOverlay = useCallback(
    (item: WorkspaceUploadItem) => {
      if (!item?.path) return;
      if (
        meshOverlayItemsRef.current.some((overlay) => overlay.path === item.path)
      ) {
        pushNotice(
          "info",
          "Already in overlay stack",
          "This file is already layered."
        );
        return;
      }
      if (meshOverlayItemsRef.current.length >= MESH_OVERLAY_LIMIT) {
        pushNotice(
          "error",
          "Overlay limit reached",
          `Only ${MESH_OVERLAY_LIMIT} overlay volumes can be active.`
        );
        return;
      }
      if (!meshVolumeEnabled) {
        setMeshVolumeEnabled(true);
        pushNotice(
          "info",
          "Volume underlay enabled",
          "Overlay volumes require the underlay renderer to be active."
        );
      }
      const presetIndex =
        meshOverlayItemsRef.current.length % MESH_OVERLAY_MATERIAL_PRESETS.length;
      const overlayItem: MeshOverlayItem = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        path: item.path,
        label: item.label,
        materialPreset: MESH_OVERLAY_MATERIAL_PRESETS[presetIndex].id,
        opacity: Math.min(1, Math.max(0.1, meshOpacity)),
        visible: true,
        renderMode: "volume",
        layer: "overlay",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        clipEnabled: false,
        clipAxis: "z",
        clipValue: 0,
        explodeEnabled: false,
        explodeDistance: 0.25,
      };
      setMeshOverlayItems((prev) => [overlayItem, ...prev]);
      setActiveMeshOverlayId(overlayItem.id);
      pushNotice(
        "success",
        "Overlay added",
        `${item.label} added to the stack.`
      );
    },
    [meshVolumeEnabled, pushNotice]
  );

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
    setAuthStepAndRoute("forgot-request");
  };

  const handleForgotCancel = () => {
    setForgotError("");
    setForgotNotice("");
    setForgotOtp("");
    setForgotPassword("");
    setForgotConfirm("");
    setAuthStepAndRoute("login");
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
      setAuthStepAndRoute("forgot-verify");
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
      setAuthStepAndRoute("login");
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
    setAuthStepAndRoute("verify-request");
  };

  const handleVerifyCancel = () => {
    setVerifyError("");
    setVerifyNotice("");
    setVerifyOtp("");
    setAuthStepAndRoute("login");
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
        setAuthStepAndRoute("login");
        return;
      }
      setVerifyNotice(response.detail);
      setAuthStepAndRoute("verify-confirm");
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
        setAuthStepAndRoute("login");
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
      setAuthStepAndRoute("login");
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

      const isZipSelection = selectionKinds.includes("zip");
      const isMultiNiftiSelection =
        selectionKinds.length === 1 &&
        selectionKinds[0] === "nifti" &&
        files.length > 1;
      const uploadIndividually =
        isWorkspace &&
        ((isZipSelection && files.length > 1) || isMultiNiftiSelection);
      const workspaceItems: WorkspaceUploadItem[] = [];
      let lastUploadedPath = "";
      let lastUploadResult: UploadResponse | null = null;

      const pushWorkspaceItem = (path: string, label: string, kind: string) => {
        workspaceItems.push({
          path,
          label,
          kind,
          createdAt: new Date().toISOString(),
          visible: true,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        });
      };

      if (uploadIndividually) {
        for (const file of files) {
          const form = new FormData();
          form.append("file", file);
          const res = await apiFetch(`${API_BASE}/api/uploads`, {
            method: "POST",
            body: form,
          });
          if (!res.ok) throw new Error(`Upload failed (${res.status})`);
          const data = (await res.json()) as UploadResponse;
          const savedPath = "saved_path" in data ? data.saved_path : "";
          if (savedPath) {
            pushWorkspaceItem(savedPath, file.name, data.kind ?? "zip");
            lastUploadedPath = savedPath;
            lastUploadResult = data;
          }
        }
      } else {
        const form = new FormData();
        if (files.length === 1) {
          form.append("file", files[0]);
        } else {
          files.forEach((item) => form.append("files", item));
        }

        const endpoint =
          files.length === 1 ? "/api/uploads" : "/api/uploads/batch";
        const res = await apiFetch(`${API_BASE}${endpoint}`, {
          method: "POST",
          body: form,
        });

        if (!res.ok) throw new Error(`Upload failed (${res.status})`);

        const data = (await res.json()) as UploadResponse;
        const savedPath = "saved_path" in data ? data.saved_path : "";
        if (savedPath) {
          const label =
            files.length === 1 ? files[0].name : `${files.length} files`;
          pushWorkspaceItem(savedPath, label, data.kind ?? "batch");
          lastUploadedPath = savedPath;
        }

        if (!isWorkspace) {
          setUploadResult(data);
        }
      }

      if (workspaceItems.length > 0) {
        setWorkspaceUploads((prev) => {
          const next = [
            ...workspaceItems,
            ...prev.filter(
              (item) => !workspaceItems.some((entry) => entry.path === item.path)
            ),
          ];
          return next;
        });
      }

      if (isWorkspace) {
        if (workspaceItems.length > 0) {
          const nextPath = workspaceItems[0].path;
          setWorkspacePath(nextPath);
          setActiveWorkspaceIndex(0);
        }
        setUploadPreview(null);
        pushNotice("success", "Upload complete", "Scan saved successfully.");
        return;
      }

      setUploadPreview(null);
      pushNotice("success", "Upload complete", "Scan saved successfully.");

      const nextPath = workspaceItems[0]?.path || lastUploadedPath;
      if (nextPath) {
        const previewRes = await apiFetch(
          `${API_BASE}/api/uploads/preview?path=${encodeURIComponent(nextPath)}`
        );
        if (previewRes.ok) {
          const preview = (await previewRes.json()) as UploadPreview;
          setUploadPreview(preview);
          setPreviewPath(nextPath);
        }
      }
      if (!isWorkspace && lastUploadResult) {
        setUploadResult(lastUploadResult);
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

  useEffect(() => {
    if (!showLoginScene) {
      if (loginBrainCleanupRef.current) {
        loginBrainCleanupRef.current();
        loginBrainCleanupRef.current = null;
      }
      return;
    }
    if (loginBrainCleanupRef.current) return;
    const container = loginBrainRef.current;
    if (!container) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const lowPowerDevice = false;

    THREE.Cache.enabled = true;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.12);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0.1, 4.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    const pixelRatio = window.devicePixelRatio || 1;
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x202020, 0.45);
    scene.add(hemiLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(3, 2, 3);
    scene.add(keyLight);

    const group = new THREE.Group();
    group.position.y = -1.2;
    scene.add(group);

    let brainModel: THREE.Object3D | null = null;
    const loader = new GLTFLoader();
    loader.load(
      LOGIN_MODEL_URL,
      (gltf) => {
        brainModel = gltf.scene;
      brainModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        }
      });
      const box = new THREE.Box3().setFromObject(brainModel);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2.2 / maxDim;
        brainModel.scale.setScalar(scale);
        const center = new THREE.Vector3();
        box.getCenter(center);
        brainModel.position.sub(center.multiplyScalar(scale));
        group.add(brainModel);
      },
      undefined,
      (error) => {
        console.error("Failed to load brain model", error);
      }
    );

    const resize = () => {
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    if (!prefersReduced) {
      anime({
        targets: group.position,
        y: 0,
        duration: 1800,
        easing: "easeOutExpo",
      });
    } else {
      group.position.y = 0;
    }

    let raf = 0;
    const clock = new THREE.Clock();
    let isVisible = document.visibilityState === "visible";
    const onVisibility = () => {
      isVisible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);
    const animate = (time = 0) => {
      if (!isVisible) {
        raf = window.requestAnimationFrame(animate);
        return;
      }
      const delta = clock.getDelta();
      const t = clock.elapsedTime;
      group.rotation.y += delta * 0.25;
      group.rotation.x = Math.sin(t * 0.3) * 0.08;
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };
    animate();

    loginBrainCleanupRef.current = () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.cancelAnimationFrame(raf);
      renderer.dispose();
      if (brainModel) {
        brainModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.geometry) {
              mesh.geometry.dispose();
            }
            const material = mesh.material;
            if (Array.isArray(material)) {
              material.forEach((mat) => mat.dispose());
            } else if (material) {
              material.dispose();
            }
          }
        });
      }
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [showLoginScene]);

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
      const bounds = getWorkspaceBounds();
      const panelEl =
        state.panel === "left" ? leftPanelRef.current : rightPanelRef.current;
      const panelWidth = panelEl?.offsetWidth ?? panelSizes[state.panel].width;
      const panelHeight =
        panelEl?.offsetHeight ?? panelSizes[state.panel].height;
      const minX = 8;
      const minY = 8;
      const maxX = Math.max(minX, bounds.width - panelWidth - 8);
      const maxY = Math.max(minY, bounds.height - panelHeight - 8);
      const nextX = Math.min(
        maxX,
        Math.max(minX, event.clientX - state.offsetX - bounds.left)
      );
      const nextY = Math.min(
        maxY,
        Math.max(minY, event.clientY - state.offsetY - bounds.top)
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
  }, [draggingPanel, getWorkspaceBounds, panelSizes]);

  useEffect(() => {
    if (!resizingPanel) return undefined;
    const onMove = (event: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;
      const bounds = getWorkspaceBounds();
      const minWidth = 220;
      const maxWidth = Math.min(520, bounds.width - 40);
      const minHeight = 240;
      const maxHeight = Math.min(760, bounds.height - 40);
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
      const minY = 8;
      const maxX = Math.max(minX, bounds.width - nextWidth - 8);
      const maxY = Math.max(minY, bounds.height - nextHeight - 8);
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
  }, [getWorkspaceBounds, resizingPanel]);

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
    const params = new URLSearchParams();
    params.set("path", uploadPath);
    params.set("view", viewerMode);
    if (viewerMode === "3d") {
      params.set("mode", viewer3dMode);
    }
    navigate({ pathname: "/workspace", search: params.toString() });
  };

  const selectWorkspaceUpload = useCallback(
    (index: number) => {
      const item = workspaceUploads[index];
      if (!item) return;
      setActiveWorkspaceIndex(index);
      setWorkspacePath(item.path);
      if (isWorkspace) {
        const params = new URLSearchParams();
        params.set("path", item.path);
        params.set("view", viewerMode);
        if (viewerMode === "3d") {
          params.set("mode", viewer3dMode);
        }
        navigate({ pathname: "/workspace", search: params.toString() }, { replace: true });
      }
    },
    [isWorkspace, navigate, viewer3dMode, viewerMode, workspaceUploads]
  );

  useEffect(() => {
    if (!workspacePath) return;
    const index = workspaceUploads.findIndex(
      (item) => item.path === workspacePath
    );
    if (index >= 0 && index !== activeWorkspaceIndex) {
      setActiveWorkspaceIndex(index);
    }
  }, [activeWorkspaceIndex, workspacePath, workspaceUploads]);

  const handleBackToWorkflow = () => {
    navigate("/");
  };

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
      <div className="login-brain" ref={loginBrainRef} />
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
      <div className="login-noise" />
      <div className="login-vignette" />
    </div>
  );

  const docsPage = <DocsPage />;
  const anatomyPage = <FemaleAnatomyPage />;
  const reportPage = <ReportAnalysis />;

  const workspacePage = (
    <WorkspacePage
      selectionLabel={selectionLabel}
      selectionWarning={selectionWarning}
      uploadPath={uploadPath}
      authUser={authUser}
      authRoleLabel={authRoleLabel}
      authDisplayName={authDisplayName}
      handleLogout={handleLogout}
      enable3DViewer={enable3DViewer}
      viewerMode={viewerMode}
      setViewerMode={setViewerMode}
      viewer3dMode={viewer3dMode}
      setViewer3dMode={setViewer3dMode}
      showLeftShelf={showLeftShelf}
      setShowLeftShelf={setShowLeftShelf}
      showRightShelf={showRightShelf}
      setShowRightShelf={setShowRightShelf}
      handleFileChange={handleFileChange}
      handleUpload={handleUpload}
      uploading={uploading}
      files={files}
      handleBackToWorkflow={handleBackToWorkflow}
      workspaceShellRef={workspaceShellRef}
      viewerError={viewerError}
      viewerLoading={viewerLoading}
      volumeInfo={volumeInfo}
      axisSizes={axisSizes}
      sliceIndex={sliceIndex}
      sliceRequestIndex={sliceRequestIndex}
      buildSliceUrl={buildSliceUrl}
      imageRefs={imageRefs}
      renderOverlay={renderOverlay}
      canvasRefs={canvasRefs}
      handlePointerDown={handlePointerDown}
      handlePointerMove={handlePointerMove}
      handlePointerUp={handlePointerUp}
      setSliceIndex={setSliceIndex}
      viewer3dLoading={viewer3dLoading}
      meshLoading={meshLoading}
      setViewerContainerRef={setViewerContainerRef}
      setMeshContainerRef={setMeshContainerRef}
      viewer3dError={viewer3dError}
      meshError={meshError}
      leftPanelRef={leftPanelRef}
      rightPanelRef={rightPanelRef}
      panelPositions={panelPositions}
      panelSizes={panelSizes}
      beginPanelDrag={beginPanelDrag}
      beginPanelResize={beginPanelResize}
      WORKSPACE_TOOLS={WORKSPACE_TOOLS}
      workspaceTool={workspaceTool}
      setWorkspaceTool={setWorkspaceTool}
      brushSize={brushSize}
      setBrushSize={setBrushSize}
      overlayOpacity={overlayOpacity}
      setOverlayOpacity={setOverlayOpacity}
      handleUndo={handleUndo}
      handleClearSlice={handleClearSlice}
      handleClearAll={handleClearAll}
      handleExportAnnotations={handleExportAnnotations}
      meshTool={meshTool}
      setMeshTool={setMeshTool}
      meshSculptEnabled={meshSculptEnabled}
      meshBrushSize={meshBrushSize}
      setMeshBrushSize={setMeshBrushSize}
      meshStrength={meshStrength}
      setMeshStrength={setMeshStrength}
      meshSelectionCount={meshSelectionCount}
      meshPickedLabel={meshPickedLabel}
      meshSelectionRadius={meshSelectionRadius}
      setMeshSelectionRadius={setMeshSelectionRadius}
      meshSelectionStrength={meshSelectionStrength}
      setMeshSelectionStrength={setMeshSelectionStrength}
      meshSelectionPrecision={meshSelectionPrecision}
      setMeshSelectionPrecision={setMeshSelectionPrecision}
      meshLabelEnabled={meshLabelEnabled}
      setMeshLabelEnabled={setMeshLabelEnabled}
      meshAnatomyEnabled={meshAnatomyEnabled}
      setMeshAnatomyEnabled={setMeshAnatomyEnabled}
      meshAnatomyPreset={meshAnatomyPreset}
      setMeshAnatomyPreset={setMeshAnatomyPreset}
      meshSignalEnabled={meshSignalEnabled}
      setMeshSignalEnabled={setMeshSignalEnabled}
      meshSignalSpeed={meshSignalSpeed}
      setMeshSignalSpeed={setMeshSignalSpeed}
      meshSignalTargetId={meshSignalTargetId}
      setMeshSignalTargetId={setMeshSignalTargetId}
      meshVertexCount={meshVertexCount}
      nudgeMeshSelection={nudgeMeshSelection}
      clearMeshSelection={clearMeshSelection}
      clearMeshLabel={clearMeshLabel}
      meshExplodeEnabled={meshExplodeEnabled}
      setMeshExplodeEnabled={setMeshExplodeEnabled}
      meshCanSculpt={meshCanSculpt}
      sliceColormap={sliceColormap}
      setSliceColormap={setSliceColormap}
      SLICE_COLORMAPS={SLICE_COLORMAPS}
      viewerChannel={viewerChannel}
      setViewerChannel={setViewerChannel}
      channelLabels={channelLabels}
      volumeColormap={volumeColormap}
      setVolumeColormap={setVolumeColormap}
      VOLUME_COLORMAPS={VOLUME_COLORMAPS}
      volumeOpacity={volumeOpacity}
      setVolumeOpacity={setVolumeOpacity}
      clipEnabled={clipEnabled}
      setClipEnabled={setClipEnabled}
      clipAxis={clipAxis}
      setClipAxis={setClipAxis}
      clipValue={clipValue}
      setClipValue={setClipValue}
      meshIso={meshIso}
      setMeshIso={setMeshIso}
      meshStep={meshStep}
      setMeshStep={setMeshStep}
      meshSource={meshSource}
      setMeshSource={setMeshSource}
      meshMaskAvailable={meshMaskAvailable}
      meshVolumeEnabled={meshVolumeEnabled}
      setMeshVolumeEnabled={setMeshVolumeEnabled}
      meshVolumeColormap={meshVolumeColormap}
      setMeshVolumeColormap={setMeshVolumeColormap}
      meshVolumeOpacity={meshVolumeOpacity}
      setMeshVolumeOpacity={setMeshVolumeOpacity}
      meshOpacity={meshOpacity}
      setMeshOpacity={setMeshOpacity}
      meshVesselEnabled={meshVesselEnabled}
      setMeshVesselEnabled={setMeshVesselEnabled}
      meshVesselThreshold={meshVesselThreshold}
      setMeshVesselThreshold={setMeshVesselThreshold}
      meshVesselSigmaMin={meshVesselSigmaMin}
      setMeshVesselSigmaMin={setMeshVesselSigmaMin}
      meshVesselSigmaMax={meshVesselSigmaMax}
      setMeshVesselSigmaMax={setMeshVesselSigmaMax}
      meshVesselStep={meshVesselStep}
      setMeshVesselStep={setMeshVesselStep}
      meshOverlayEnabled={meshOverlayEnabled}
      setMeshOverlayEnabled={setMeshOverlayEnabled}
      meshOverlayOpacity={meshOverlayOpacity}
      setMeshOverlayOpacity={setMeshOverlayOpacity}
      meshOverlayIso={meshOverlayIso}
      setMeshOverlayIso={setMeshOverlayIso}
      meshOverlayStep={meshOverlayStep}
      setMeshOverlayStep={setMeshOverlayStep}
      meshOverlayLockEnabled={meshOverlayLockEnabled}
      setMeshOverlayLockEnabled={setMeshOverlayLockEnabled}
      meshOverlayLockTarget={meshOverlayLockTarget}
      setMeshOverlayLockTarget={setMeshOverlayLockTarget}
      MAX_MESH_PARTS={MAX_MESH_PARTS}
      meshGroupCount={meshGroupCount}
      setMeshGroupCount={setMeshGroupCount}
      meshMaterialPreset={meshMaterialPreset}
      setMeshMaterialPreset={setMeshMaterialPreset}
      MESH_MATERIAL_PRESETS={MESH_MATERIAL_PRESETS}
      meshWireframe={meshWireframe}
      setMeshWireframe={setMeshWireframe}
      meshClipEnabled={meshClipEnabled}
      setMeshClipEnabled={setMeshClipEnabled}
      meshClipAxis={meshClipAxis}
      setMeshClipAxis={setMeshClipAxis}
      meshClipValue={meshClipValue}
      setMeshClipValue={setMeshClipValue}
      meshExplodeDistance={meshExplodeDistance}
      setMeshExplodeDistance={setMeshExplodeDistance}
      meshIsolateEnabled={meshIsolateEnabled}
      setMeshIsolateEnabled={setMeshIsolateEnabled}
      meshPartCount={meshPartCount}
      meshActiveGroup={meshActiveGroup}
      stepMeshActiveGroup={stepMeshActiveGroup}
      activePartOffset={activePartOffset}
      updateActivePartOffset={updateActivePartOffset}
      resetPartOffsets={resetPartOffsets}
      hasPartOffsets={hasPartOffsets}
      requestMeshRebuild={requestMeshRebuild}
      handleAddLabel={handleAddLabel}
      labels={labels}
      activeLabelId={activeLabelId}
      setActiveLabelId={setActiveLabelId}
      handleLabelUpdate={handleLabelUpdate}
      handleRemoveLabel={handleRemoveLabel}
      activeSliceCount={activeSliceCount}
      annotationSummary={annotationSummary}
      labelMap={labelMap}
      meshHint={meshHint}
      activeAxis={activeAxis}
      notices={notices}
      workspaceUploads={workspaceUploads}
      clearWorkspaceUploads={clearWorkspaceUploads}
      workspacePath={workspacePath}
      selectWorkspaceUpload={selectWorkspaceUpload}
      addWorkspaceUploadToOverlay={addWorkspaceUploadToOverlay}
      updateWorkspaceUpload={updateWorkspaceUpload}
      meshOverlayItems={meshOverlayItems}
      activeMeshOverlayId={activeMeshOverlayId}
      setActiveMeshOverlayId={setActiveMeshOverlayId}
      MESH_OVERLAY_LIMIT={MESH_OVERLAY_LIMIT}
      meshOverlayDropActive={meshOverlayDropActive}
      setMeshOverlayDropActive={setMeshOverlayDropActive}
      handleMeshOverlayDrop={handleMeshOverlayDrop}
      handleMeshOverlayFilesChange={handleMeshOverlayFilesChange}
      meshOverlayFiles={meshOverlayFiles}
      meshOverlayUploading={meshOverlayUploading}
      removeMeshOverlayItem={removeMeshOverlayItem}
      moveMeshOverlayItem={moveMeshOverlayItem}
      updateMeshOverlayItem={updateMeshOverlayItem}
      MESH_OVERLAY_MATERIAL_PRESETS={MESH_OVERLAY_MATERIAL_PRESETS}
    />
  );

  if (showAuthGate) {
    return (
      <div className="login-screen" ref={loginScreenRef}>
        {loginBackdrop}
        <div className="login-shell login-shell-gate">
          <div className="login-card login-card-authgate">
            <div className="login-card-glow" aria-hidden="true" />
            <div className="login-card-grid" aria-hidden="true" />
            <h2>Checking your session</h2>
            <p>Please wait a second while we verify your access.</p>
            <div className="login-authgate-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
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
                    <Input
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
                      className="login-input"
                    />
                  </label>
                  <label className="login-field">
                    <span>Password</span>
                    <Input
                      type="password"
                      value={authPassword}
                      onChange={(event) => {
                        setAuthPassword(event.target.value);
                        if (authError) setAuthError("");
                        if (authNotice) setAuthNotice("");
                      }}
                      onKeyUp={handleCapsLock}
                      onKeyDown={handleCapsLock}
                      onBlur={clearCapsLock}
                      placeholder="enter your password"
                      autoComplete="current-password"
                      required
                      className="login-input"
                    />
                  </label>
                  {isCapsLockOn && (
                    <div className="login-warning" role="status">
                      Caps Lock is on.
                    </div>
                  )}
                  <Button
                    type="submit"
                    variant="accent"
                    className="btn-block"
                    disabled={authLoading}
                  >
                    {authLoading ? "Signing in..." : "Sign in"}
                  </Button>
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
                    <Input
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
                      className="login-input"
                    />
                  </label>
                  <Button
                    type="submit"
                    variant="accent"
                    className="btn-block"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? "Sending code..." : "Send code"}
                  </Button>
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
                    <Input
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
                      className="login-input"
                    />
                  </label>
                  <label className="login-field">
                    <span>Verification code</span>
                    <Input
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
                      className="login-input"
                    />
                  </label>
                  <label className="login-field">
                    <span>New password</span>
                    <Input
                      type="password"
                      value={forgotPassword}
                      onChange={(event) => {
                        setForgotPassword(event.target.value);
                        if (forgotError) setForgotError("");
                      }}
                      onKeyUp={handleCapsLock}
                      onKeyDown={handleCapsLock}
                      onBlur={clearCapsLock}
                      placeholder="Create a new password"
                      autoComplete="new-password"
                      required
                      className="login-input"
                    />
                  </label>
                  {isCapsLockOn && (
                    <div className="login-warning" role="status">
                      Caps Lock is on.
                    </div>
                  )}
                  <label className="login-field">
                    <span>Confirm password</span>
                    <Input
                      type="password"
                      value={forgotConfirm}
                      onChange={(event) => {
                        setForgotConfirm(event.target.value);
                        if (forgotError) setForgotError("");
                      }}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      required
                      className="login-input"
                    />
                  </label>
                  <Button
                    type="submit"
                    variant="accent"
                    className="btn-block"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? "Resetting..." : "Reset password"}
                  </Button>
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
                    <Input
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
                      className="login-input"
                    />
                  </label>
                  <Button
                    type="submit"
                    variant="accent"
                    className="btn-block"
                    disabled={verifyLoading}
                  >
                    {verifyLoading ? "Sending code..." : "Send code"}
                  </Button>
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
                    <Input
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
                      className="login-input"
                    />
                  </label>
                  <label className="login-field">
                    <span>Verification code</span>
                    <Input
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
                      className="login-input"
                    />
                  </label>
                  <Button
                    type="submit"
                    variant="accent"
                    className="btn-block"
                    disabled={verifyLoading}
                  >
                    {verifyLoading ? "Verifying..." : "Verify email"}
                  </Button>
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
    return workspacePage;
  }

  const isDevRoute = location.pathname === "/dev";

  return (
    <div
      className={`app-shell ${isDocsRoute ? "docs-shell" : ""} ${
        isAnatomyRoute ? "anatomy-shell-page" : ""
      } ${isDevRoute ? "dev-shell" : ""}`}
    >
      <div className="ambient" aria-hidden="true" />
      <div
        className={`topbar topbar-full ${
          isDocsRoute || isAnatomyRoute || isDevRoute ? "topbar-compact" : ""
        } ${isDocsRoute ? "topbar-docs" : ""}`}
      >
        <div className="topbar-inner">
          <div className="topbar-brand">
            <span>Corpus Medica</span>
            <span className="topbar-tag">Medical AI workspace</span>
          </div>
          <nav className="topbar-nav" aria-label="Primary">
            <Link
              className={`topbar-link ${location.pathname === "/" ? "active" : ""}`}
              to="/"
            >
              Overview
            </Link>
            <Link
              className={`topbar-link ${location.pathname === "/reports" ? "active" : ""}`}
              to="/reports"
            >
              Report analysis
            </Link>
            <Link
              className={`topbar-link ${location.pathname === "/anatomy" ? "active" : ""}`}
              to="/anatomy"
            >
              Female anatomy
            </Link>
            <a
              className="topbar-link"
              href={Z_ANATOMY_URL}
              target="_blank"
              rel="noreferrer"
            >
              Anatomy
            </a>
            <Link
              className={`topbar-link topbar-link-docs ${
                location.pathname.startsWith("/docs") ? "active" : ""
              }`}
              to="/docs"
            >
              Docs
            </Link>
            <Link
              className={`topbar-link ${location.pathname === "/dev" ? "active" : ""}`}
              to="/dev"
            >
              Team
            </Link>
          </nav>
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
      </div>
      <div
        className={`app ${
          isDocsRoute || isAnatomyRoute || isDevRoute ? "app-full" : ""
        }`}
        id="top"
      >
      <Routes>
        <Route
          path="/"
          element={
            <>
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

        <div
          className={`dropzone ${files.length > 0 ? "has-file" : ""} ${
            uploadDropActive ? "is-active" : ""
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setUploadDropActive(true);
          }}
          onDragLeave={() => setUploadDropActive(false)}
          onDrop={handleUploadDrop}
        >
          <input
            id="scan-upload"
            className="file-input"
            type="file"
            onChange={handleFileChange}
            multiple
            accept=".nii,.nii.gz,.dcm,.dicom,.zip"
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
          {!isWorkspace && (uploadResult || uploadPreview || files.length > 0) && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={clearOverviewUpload}
              disabled={uploading}
            >
              Clear
            </button>
          )}
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
                  <div
                    className="viewer-3d-canvas"
                    ref={setViewerContainerRef}
                  />
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

            </>
          }
        />
        <Route path="/anatomy" element={anatomyPage} />
        <Route path="/reports" element={reportPage} />
        <Route path="/docs/*" element={docsPage} />
        <Route path="/dev" element={<DevPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>

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
