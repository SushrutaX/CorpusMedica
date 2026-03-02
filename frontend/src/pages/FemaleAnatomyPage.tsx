import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Slider } from "../components/ui/Slider";
import { Switch } from "../components/ui/Switch";

type AnatomyLayer = {
  id: string;
  name: string;
  description: string;
  visible: boolean;
  opacity: number;
};

type AnatomySystem = {
  id: string;
  title: string;
  layers: AnatomyLayer[];
};

type LoadedGlbModel = {
  id: string;
  name: string;
  url: string;
  source: "preset" | "local";
  visible: boolean;
  opacity: number;
  scale: number;
  order: number;
  loading: boolean;
  error?: string;
};

const DEFAULT_SYSTEMS: AnatomySystem[] = [
  {
    id: "surface",
    title: "Surface",
    layers: [
      {
        id: "skin",
        name: "Skin",
        description: "Epidermis + dermis envelope.",
        visible: true,
        opacity: 0.85,
      },
      {
        id: "subcutaneous-fat",
        name: "Subcutaneous fat",
        description: "Superficial adipose layer.",
        visible: true,
        opacity: 0.55,
      },
    ],
  },
  {
    id: "musculoskeletal",
    title: "Musculoskeletal",
    layers: [
      {
        id: "muscle",
        name: "Muscle",
        description: "Major muscle groups and fascia.",
        visible: true,
        opacity: 0.85,
      },
      {
        id: "skeleton",
        name: "Skeleton",
        description: "Cranial, axial, appendicular bones.",
        visible: true,
        opacity: 0.9,
      },
    ],
  },
  {
    id: "organs",
    title: "Organs",
    layers: [
      {
        id: "cardiopulmonary",
        name: "Cardiopulmonary",
        description: "Heart, lungs, trachea.",
        visible: true,
        opacity: 0.9,
      },
      {
        id: "abdominopelvic",
        name: "Abdominopelvic",
        description: "Liver, kidneys, bowel, uterus.",
        visible: true,
        opacity: 0.9,
      },
    ],
  },
  {
    id: "neurovascular",
    title: "Neurovascular",
    layers: [
      {
        id: "vascular",
        name: "Vascular",
        description: "Arteries, veins, major vessels.",
        visible: true,
        opacity: 0.7,
      },
      {
        id: "nervous",
        name: "Nervous system",
        description: "Brain + peripheral nerves.",
        visible: true,
        opacity: 0.7,
      },
    ],
  },
];

const TOOL_PRESETS = [
  "Layer peel",
  "Explode view",
  "Clip box",
  "Isolate organ",
  "Label & pin",
  "Search",
];

const ATLAS_ASSET_URL = "/anatomy/female_atlas.glb";
const PRESET_GLB_MODELS = [
  {
    id: "female-atlas",
    name: "Female atlas",
    url: "/anatomy/female_atlas.glb",
  },
  {
    id: "female-vasculature",
    name: "Vasculature",
    url: "/anatomy/female_vascular.glb",
  },
  {
    id: "female-skeleton",
    name: "Skeleton",
    url: "/anatomy/female_skeleton.glb",
  },
  {
    id: "female-musculature",
    name: "Musculature",
    url: "/anatomy/female_muscle.glb",
  },
];

const LAYER_KEYWORDS: Record<string, string[]> = {
  skin: ["skin", "dermis", "epidermis"],
  "subcutaneous-fat": ["fat", "adipose", "subcut", "subcutaneous"],
  muscle: ["muscle", "muscular", "fascia"],
  skeleton: ["bone", "skeleton", "skull", "vertebra", "rib", "femur"],
  cardiopulmonary: ["heart", "lung", "trachea", "bronch", "pleura"],
  abdominopelvic: [
    "liver",
    "kidney",
    "stomach",
    "bowel",
    "uterus",
    "ovary",
    "intestin",
    "pancreas",
    "spleen",
    "bladder",
  ],
  vascular: ["artery", "vein", "vessel", "aorta", "vena", "vascular"],
  nervous: ["nerve", "brain", "spinal", "cns", "pns", "neuron"],
};

const PREFERRED_LAYER_ORDER = [
  "skin",
  "subcutaneous-fat",
  "muscle",
  "skeleton",
  "cardiopulmonary",
  "abdominopelvic",
  "vascular",
  "nervous",
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const frameCameraToBounds = (
  camera: THREE.PerspectiveCamera,
  controls: any,
  bounds: THREE.Box3
) => {
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = (camera.fov * Math.PI) / 180;
  let distance = maxDim / (2 * Math.tan(fov / 2));
  distance *= 1.6;

  camera.near = Math.max(0.01, distance / 100);
  camera.far = Math.max(camera.near + 10, distance * 10);
  camera.updateProjectionMatrix();

  camera.position.set(center.x, center.y + maxDim * 0.05, center.z + distance);
  if (controls?.target) {
    controls.target.copy(center);
    controls.update?.();
  }
};

const normalizeAtlasScale = (group: THREE.Group, bounds: THREE.Box3) => {
  const size = bounds.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const targetMax = 2.2;
  if (maxDim > 0 && maxDim < targetMax) {
    const scale = targetMax / maxDim;
    group.scale.setScalar(scale);
    group.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(group);
  }
  return bounds;
};

const pickLayerFromName = (name: string) => {
  const normalized = name.toLowerCase();
  for (const [layer, keywords] of Object.entries(LAYER_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return layer;
    }
  }
  return "abdominopelvic";
};

const applyMaterialTuning = (material: THREE.Material, opacity: number) => {
  const tuned = material as THREE.Material & {
    opacity?: number;
    transparent?: boolean;
    depthWrite?: boolean;
    depthTest?: boolean;
    polygonOffset?: boolean;
    polygonOffsetFactor?: number;
    polygonOffsetUnits?: number;
  };
  const nextOpacity = clamp(opacity, 0.05, 1);
  tuned.transparent = nextOpacity < 0.99;
  tuned.opacity = nextOpacity;
  tuned.depthTest = true;
  tuned.depthWrite = !tuned.transparent;
  tuned.polygonOffset = true;
  tuned.polygonOffsetFactor = 1;
  tuned.polygonOffsetUnits = 1;
  material.needsUpdate = true;
};

const FemaleAnatomyPage = () => {
  const [systems, setSystems] = useState<AnatomySystem[]>(DEFAULT_SYSTEMS);
  const [atlasReady, setAtlasReady] = useState(false);
  const [atlasLoading, setAtlasLoading] = useState(false);
  const [atlasError, setAtlasError] = useState<string>("");
  const [atlasProgress, setAtlasProgress] = useState(0);
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipAxis, setClipAxis] = useState<"x" | "y" | "z">("y");
  const [clipValue, setClipValue] = useState(0.5);
  const [explodeEnabled, setExplodeEnabled] = useState(false);
  const [explodeDistance, setExplodeDistance] = useState(0.6);
  const [searchQuery, setSearchQuery] = useState("");
  const [isolateTarget, setIsolateTarget] = useState<string>("");
  const [labelEnabled, setLabelEnabled] = useState(true);
  const [peelLevel, setPeelLevel] = useState(0);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [glbModels, setGlbModels] = useState<LoadedGlbModel[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const atlasGroupRef = useRef<THREE.Group | null>(null);
  const meshListRef = useRef<THREE.Mesh[]>([]);
  const labelSpriteRef = useRef<THREE.Sprite | null>(null);
  const clipPlaneRef = useRef<THREE.Plane | null>(null);
  const atlasBoundsRef = useRef<THREE.Box3 | null>(null);
  const glbGroupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const glbUrlRef = useRef<Map<string, string>>(new Map());
  const atlasAutoLoadRef = useRef(false);
  const atlasLoadInFlightRef = useRef(false);

  const visibleCount = useMemo(() => {
    return systems.reduce((total, system) => {
      return total + system.layers.filter((layer) => layer.visible).length;
    }, 0);
  }, [systems]);

  const totalCount = useMemo(() => {
    return systems.reduce((total, system) => total + system.layers.length, 0);
  }, [systems]);

  const layerOpacityMap = useMemo(() => {
    const map = new Map<string, { visible: boolean; opacity: number }>();
    systems.forEach((system) => {
      system.layers.forEach((layer) => {
        map.set(layer.id, { visible: layer.visible, opacity: layer.opacity });
      });
    });
    return map;
  }, [systems]);

  const searchableMeshes = useMemo(() => {
    const meshes = meshListRef.current.map((mesh) => mesh.name).filter(Boolean);
    if (!searchQuery) {
      return meshes.slice(0, 12);
    }
    const lower = searchQuery.toLowerCase();
    return meshes.filter((name) => name.toLowerCase().includes(lower)).slice(0, 12);
  }, [searchQuery, atlasReady]);

  const toggleLayer = (systemId: string, layerId: string) => {
    setSystems((prev) =>
      prev.map((system) => {
        if (system.id !== systemId) {
          return system;
        }
        return {
          ...system,
          layers: system.layers.map((layer) =>
            layer.id === layerId
              ? { ...layer, visible: !layer.visible }
              : layer
          ),
        };
      })
    );
  };

  const updateOpacity = (
    systemId: string,
    layerId: string,
    opacity: number
  ) => {
    setSystems((prev) =>
      prev.map((system) => {
        if (system.id !== systemId) {
          return system;
        }
        return {
          ...system,
          layers: system.layers.map((layer) =>
            layer.id === layerId ? { ...layer, opacity } : layer
          ),
        };
      })
    );
  };

  const updateGlbModel = useCallback(
    (id: string, patch: Partial<LoadedGlbModel>) => {
      setGlbModels((prev) =>
        prev.map((model) => (model.id === id ? { ...model, ...patch } : model))
      );
    },
    []
  );

  const disposeGroup = (group: THREE.Group) => {
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
  };

  const removeGlbModel = useCallback(
    (id: string) => {
      const group = glbGroupsRef.current.get(id);
      if (group && sceneRef.current) {
        sceneRef.current.remove(group);
        disposeGroup(group);
      }
      glbGroupsRef.current.delete(id);
      const url = glbUrlRef.current.get(id);
      if (url && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
      glbUrlRef.current.delete(id);
      setGlbModels((prev) =>
        prev
          .filter((model) => model.id !== id)
          .map((model, index) => ({ ...model, order: index + 1 }))
      );
    },
    [setGlbModels]
  );

  const loadGlbModel = useCallback(
    (model: LoadedGlbModel) => {
      if (!sceneRef.current) {
        return;
      }
      const loader = new GLTFLoader();
      updateGlbModel(model.id, { loading: true, error: "" });
      loader.load(
        model.url,
        (gltf: any) => {
          const group = gltf.scene;
          group.name = model.name;
          const bounds = new THREE.Box3().setFromObject(group);
          const size = bounds.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const baseScale =
            Number.isFinite(maxDim) && maxDim > 0 ? 1 / maxDim : 1;
          group.userData.baseScale = baseScale;
          group.scale.setScalar(baseScale * model.scale);
          glbGroupsRef.current.set(model.id, group);
          glbUrlRef.current.set(model.id, model.url);
          sceneRef.current?.add(group);
          const normalizedBounds = new THREE.Box3().setFromObject(group);
          if (!atlasBoundsRef.current) {
            atlasBoundsRef.current = normalizedBounds;
            if (cameraRef.current && controlsRef.current) {
              frameCameraToBounds(
                cameraRef.current,
                controlsRef.current,
                atlasBoundsRef.current
              );
            }
          }
          updateGlbModel(model.id, { loading: false });
        },
        undefined,
        () => {
          updateGlbModel(model.id, {
            loading: false,
            error: "Failed to load GLB.",
          });
        }
      );
    },
    [updateGlbModel]
  );

  const addGlbModel = useCallback(
    (next: LoadedGlbModel) => {
      setGlbModels((prev) => {
        if (prev.some((model) => model.id === next.id)) {
          return prev;
        }
        return [...prev, next];
      });
      loadGlbModel(next);
    },
    [loadGlbModel]
  );


  const loadAtlas = useCallback(() => {
    if (
      !sceneRef.current ||
      atlasLoading ||
      atlasReady ||
      atlasLoadInFlightRef.current
    ) {
      return;
    }

    const loader = new GLTFLoader();
    setAtlasError("");
    setAtlasLoading(true);
    atlasLoadInFlightRef.current = true;
    loader.load(
      ATLAS_ASSET_URL,
      (gltf: any) => {
        const group = gltf.scene;
        atlasGroupRef.current = group;
        sceneRef.current?.add(group);

        const meshes: THREE.Mesh[] = [];
        group.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const layerId = pickLayerFromName(
              mesh.name || mesh.parent?.name || ""
            );
            mesh.userData.layerId = layerId;
            mesh.userData.basePosition = mesh.position.clone();
            const orderIndex = PREFERRED_LAYER_ORDER.indexOf(layerId);
            mesh.renderOrder = orderIndex === -1 ? 0 : orderIndex;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            meshes.push(mesh);
          }
        });

        meshListRef.current = meshes;
        const initialBounds = new THREE.Box3().setFromObject(group);
        atlasBoundsRef.current = normalizeAtlasScale(group, initialBounds);
        if (cameraRef.current && controlsRef.current && atlasBoundsRef.current) {
          frameCameraToBounds(
            cameraRef.current,
            controlsRef.current,
            atlasBoundsRef.current
          );
        }
        setAtlasReady(true);
        setAtlasLoading(false);
        atlasLoadInFlightRef.current = false;
      },
      (event: ProgressEvent<EventTarget>) => {
        if (event.total) {
          setAtlasProgress(event.loaded / event.total);
        }
      },
      () => {
        setAtlasError(
          "Atlas assets not found. Add GLB files to /public/anatomy."
        );
        setAtlasLoading(false);
        atlasLoadInFlightRef.current = false;
      }
    );
  }, [atlasLoading, atlasReady]);

  const handlePresetAdd = useCallback(
    (presetId: string) => {
      const preset = PRESET_GLB_MODELS.find((item) => item.id === presetId);
      if (!preset) return;
      if (preset.id === "female-atlas") {
        loadAtlas();
        return;
      }
      addGlbModel({
        id: preset.id,
        name: preset.name,
        url: preset.url,
        source: "preset",
        visible: true,
        opacity: 0.95,
        scale: 1,
        order: glbModels.length + 1,
        loading: false,
      });
    },
    [addGlbModel, glbModels.length, loadAtlas]
  );

  const handleLocalFiles = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        const id = `local-${file.name}-${file.size}-${file.lastModified}`;
        const url = URL.createObjectURL(file);
        addGlbModel({
          id,
          name: file.name.replace(/\.(glb|gltf)$/i, ""),
          url,
          source: "local",
          visible: true,
          opacity: 0.95,
          scale: 1,
          order: glbModels.length + 1,
          loading: false,
        });
      });
    },
    [addGlbModel, glbModels.length]
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) return;
      handleLocalFiles(files);
      event.target.value = "";
    },
    [handleLocalFiles]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files).filter((file) =>
        file.name.toLowerCase().endsWith(".glb") ||
        file.name.toLowerCase().endsWith(".gltf")
      );
      if (files.length > 0) {
        handleLocalFiles(files);
      }
    },
    [handleLocalFiles]
  );

  const hasAnyGlb = atlasReady || glbModels.length > 0;

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
    renderer.setClearColor(0x0f141d, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10151f);

    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 1.2, 3.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.6;
    controls.maxDistance = 8;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(4, 6, 4);
    const fillLight = new THREE.DirectionalLight(0x7aa7ff, 0.35);
    fillLight.position.set(-4, 3, -2);
    scene.add(ambient, keyLight, fillLight);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(renderer.domElement);

    let animationFrame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) {
        return;
      }
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      glbGroupsRef.current.forEach((group) => {
        disposeGroup(group);
      });
      glbGroupsRef.current.clear();
      glbUrlRef.current.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
      glbUrlRef.current.clear();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      atlasGroupRef.current = null;
      meshListRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (
      sceneRef.current &&
      !atlasReady &&
      !atlasLoading &&
      !atlasAutoLoadRef.current
    ) {
      atlasAutoLoadRef.current = true;
      loadAtlas();
    }
  }, [atlasReady, atlasLoading, loadAtlas]);

  useEffect(() => {
    const atlasGroup = atlasGroupRef.current;
    if (!atlasGroup) {
      return;
    }

    const peelCutoff = peelLevel * (PREFERRED_LAYER_ORDER.length - 1);
    meshListRef.current.forEach((mesh) => {
      const layerId = mesh.userData.layerId as string;
      const layerState = layerOpacityMap.get(layerId);
      const baseOpacity = layerState?.opacity ?? 0.9;
      const baseVisible = layerState?.visible ?? true;
      const layerIndex = Math.max(0, PREFERRED_LAYER_ORDER.indexOf(layerId));
      const peelStrength = clamp(peelCutoff - layerIndex, 0, 1);
      const peelOpacity = baseOpacity * (1 - peelStrength);
      const nextOpacity = clamp(peelOpacity, 0.05, 1);
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) =>
          applyMaterialTuning(material, nextOpacity)
        );
      } else if (mesh.material) {
        applyMaterialTuning(mesh.material, nextOpacity);
      }

      const shouldShow = baseVisible && nextOpacity > 0.05;
      mesh.visible = isolateTarget ? mesh.name === isolateTarget : shouldShow;
    });

    atlasGroup.visible = true;
  }, [layerOpacityMap, isolateTarget, peelLevel]);

  useEffect(() => {
    if (!atlasGroupRef.current) {
      return;
    }
    meshListRef.current.forEach((mesh) => {
      const base = mesh.userData.basePosition as THREE.Vector3;
      if (!base) {
        return;
      }
      if (!explodeEnabled) {
        mesh.position.copy(base);
        return;
      }
      const direction = base.clone().normalize();
      mesh.position.copy(base).addScaledVector(direction, explodeDistance);
    });
  }, [explodeEnabled, explodeDistance]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const atlasBounds = atlasBoundsRef.current;
    if (!renderer || !atlasBounds) {
      return;
    }

    if (!clipEnabled) {
      renderer.clippingPlanes = [];
      meshListRef.current.forEach((mesh) => {
        const material = mesh.material as THREE.Material & {
          clippingPlanes?: THREE.Plane[];
        };
        if (material?.clippingPlanes) {
          material.clippingPlanes = [];
        }
      });
      return;
    }

    const min = atlasBounds.min;
    const max = atlasBounds.max;
    const axisSize =
      clipAxis === "x"
        ? max.x - min.x
        : clipAxis === "y"
        ? max.y - min.y
        : max.z - min.z;
    const axisMin = clipAxis === "x" ? min.x : clipAxis === "y" ? min.y : min.z;
    const planePos = axisMin + axisSize * clamp(clipValue, 0, 1);
    const normal = new THREE.Vector3(
      clipAxis === "x" ? -1 : 0,
      clipAxis === "y" ? -1 : 0,
      clipAxis === "z" ? -1 : 0
    );
    const plane = new THREE.Plane(normal, planePos);
    clipPlaneRef.current = plane;
    renderer.clippingPlanes = [plane];

    meshListRef.current.forEach((mesh) => {
      const material = mesh.material as THREE.Material & {
        clippingPlanes?: THREE.Plane[];
        clipIntersection?: boolean;
      };
      if (material) {
        material.clippingPlanes = [plane];
        material.clipIntersection = true;
      }
    });
  }, [clipEnabled, clipAxis, clipValue]);

  useEffect(() => {
    if (!labelEnabled || !atlasGroupRef.current || !cameraRef.current) {
      if (labelSpriteRef.current) {
        labelSpriteRef.current.visible = false;
      }
      return;
    }

    const target = meshListRef.current.find((mesh) => mesh.name === isolateTarget);
    if (!target) {
      if (labelSpriteRef.current) {
        labelSpriteRef.current.visible = false;
      }
      return;
    }

    const labelText = target.name || "Selected structure";
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = 512;
    spriteCanvas.height = 128;
    const ctx = spriteCanvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.fillStyle = "rgba(19, 26, 36, 0.85)";
    ctx.fillRect(0, 0, spriteCanvas.width, spriteCanvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px Space Grotesk, sans-serif";
    ctx.fillText(labelText, 24, 80);

    const texture = new THREE.CanvasTexture(spriteCanvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1.4, 0.35, 1);

    const box = new THREE.Box3().setFromObject(target);
    const center = box.getCenter(new THREE.Vector3());
    sprite.position.copy(center).add(new THREE.Vector3(0, 0.3, 0));

    if (labelSpriteRef.current) {
      atlasGroupRef.current.remove(labelSpriteRef.current);
    }
    labelSpriteRef.current = sprite;
    atlasGroupRef.current.add(sprite);
  }, [labelEnabled, isolateTarget]);

  useEffect(() => {
    glbModels.forEach((model) => {
      const group = glbGroupsRef.current.get(model.id);
      if (!group) return;
      group.visible = model.visible;
      const baseScale = (group.userData.baseScale as number) ?? 1;
      group.scale.setScalar(baseScale * model.scale);
      group.renderOrder = model.order;
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.renderOrder = model.order;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material) =>
              applyMaterialTuning(material, model.opacity)
            );
          } else if (mesh.material) {
            applyMaterialTuning(mesh.material, model.opacity);
          }
        }
      });
    });
  }, [glbModels]);

  const handleSelectMesh = (name: string) => {
    setIsolateTarget(name);
  };

  const moveGlbOrder = (id: string, direction: "up" | "down") => {
    setGlbModels((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((model) => model.id === id);
      if (index === -1) return prev;
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= sorted.length) return prev;
      const temp = sorted[index];
      sorted[index] = sorted[swapIndex];
      sorted[swapIndex] = temp;
      return sorted.map((model, idx) => ({ ...model, order: idx + 1 }));
    });
  };

  return (
    <div className="anatomy-workspace">
      <div className="ambient" aria-hidden="true" />
      <div className="anatomy-hud">
        <div className="anatomy-brand">
          <span>Corpus Medica</span>
          <strong>Female anatomy viewport</strong>
        </div>
        <div className="anatomy-status">
          <Badge>Layers {visibleCount}/{totalCount}</Badge>
          <Badge>GLB atlas</Badge>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setShowLeftPanel((prev) => !prev)}
          >
            {showLeftPanel ? "Hide systems" : "Show systems"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setShowRightPanel((prev) => !prev)}
          >
            {showRightPanel ? "Hide tools" : "Show tools"}
          </Button>
          <Button
            variant="accent"
            size="sm"
            type="button"
            onClick={loadAtlas}
            disabled={atlasReady || atlasLoading}
          >
            {atlasReady
              ? "Atlas ready"
              : atlasLoading
              ? "Loading..."
              : "Load atlas"}
          </Button>
        </div>
      </div>

      <div className="anatomy-shell">
        {showLeftPanel && (
        <aside className="anatomy-shelf anatomy-shelf-left">
          <div className="shelf-head">
            <h3>Systems</h3>
            <span>Inside-out controls</span>
          </div>
          {systems.map((system) => (
            <div key={system.id} className="shelf-group">
              <h4>{system.title}</h4>
              {system.layers.map((layer) => (
                <div key={layer.id} className="shelf-layer">
                  <div className="shelf-layer-top">
                    <div>
                      <strong>{layer.name}</strong>
                      <p>{layer.description}</p>
                    </div>
                    <Switch
                      checked={layer.visible}
                      onChange={() => toggleLayer(system.id, layer.id)}
                      aria-label={`Toggle ${layer.name}`}
                    />
                  </div>
                  <div className="shelf-slider">
                    <span>Opacity</span>
                    <Slider
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={layer.opacity}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        updateOpacity(
                          system.id,
                          layer.id,
                          Number(event.target.value)
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </aside>
        )}

        <main className="anatomy-viewport">
          <div
            className="anatomy-canvas"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="female-anatomy-canvas-inner" ref={containerRef} />
            {!hasAnyGlb && (
              <div className="anatomy-placeholder">
                <h2>3D anatomy viewport</h2>
                <p>
                  Place the atlas GLB at <code>{ATLAS_ASSET_URL}</code> to render
                  the full female body. This viewer mirrors the workspace layout
                  with shelves, tools, and overlays.
                </p>
                <div className="placeholder-grid">
                  <Card className="placeholder-card">Layer peel</Card>
                  <Card className="placeholder-card">Clip + explode</Card>
                  <Card className="placeholder-card">Isolate + label</Card>
                </div>
              </div>
            )}
            {atlasLoading && (
              <div className="anatomy-progress">
                <span>Loading atlas</span>
                <div className="progress-bar">
                  <span style={{ width: `${Math.round(atlasProgress * 100)}%` }} />
                </div>
              </div>
            )}
            {!hasAnyGlb && atlasError && (
              <div className="anatomy-error">{atlasError}</div>
            )}
          </div>
        </main>

        {showRightPanel && (
        <aside className="anatomy-shelf anatomy-shelf-right">
          <div className="shelf-head">
            <h3>Tools</h3>
            <span>Atlas controls</span>
          </div>
          <div className="tool-list">
            {TOOL_PRESETS.map((tool) => (
              <span key={tool} className="tool-pill">
                {tool}
              </span>
            ))}
          </div>
          <div className="shelf-tool">
            <label>GLB library</label>
            <div className="glb-model-list">
              {PRESET_GLB_MODELS.map((preset) => {
                const isLoaded = glbModels.some(
                  (model) => model.id === preset.id
                );
                return (
                  <Card key={preset.id} className="glb-model-card">
                    <div className="glb-model-header">
                      <div>
                        <strong>{preset.name}</strong>
                        <span>{isLoaded ? "Loaded" : "Preset"}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePresetAdd(preset.id)}
                        disabled={isLoaded}
                      >
                        {isLoaded ? "Ready" : "Load"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Add local GLB
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf"
              multiple
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>
          <div className="shelf-tool">
            <label>Loaded models</label>
            {glbModels.length === 0 ? (
              <p className="shelf-note-text">No extra models loaded yet.</p>
            ) : (
              <div className="glb-model-list">
                {glbModels.map((model) => (
                  <Card key={model.id} className="glb-model-card">
                    <div className="glb-model-header">
                      <div>
                        <strong>{model.name}</strong>
                        <span>Layer {model.order}</span>
                        {model.loading && <span>Loading...</span>}
                        {model.error && <span>{model.error}</span>}
                      </div>
                      <Switch
                        checked={model.visible}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateGlbModel(model.id, {
                            visible: event.target.checked,
                          })
                        }
                        aria-label={`Toggle ${model.name}`}
                      />
                    </div>
                    <div className="glb-model-controls">
                      <span>Order</span>
                      <div className="glb-order-buttons">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveGlbOrder(model.id, "up")}
                        >
                          Up
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveGlbOrder(model.id, "down")}
                        >
                          Down
                        </Button>
                      </div>
                    </div>
                    <div className="glb-model-controls">
                      <span>Opacity</span>
                      <Slider
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={model.opacity}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateGlbModel(model.id, {
                            opacity: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="glb-model-controls">
                      <span>Scale</span>
                      <Slider
                        min={0.2}
                        max={3}
                        step={0.05}
                        value={model.scale}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateGlbModel(model.id, {
                            scale: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGlbModel(model.id)}
                    >
                      Remove
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <div className="shelf-tool">
            <label>Peel depth</label>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={peelLevel}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPeelLevel(Number(event.target.value))}
            />
          </div>
          <div className="shelf-tool">
            <label>Explode view</label>
            <Switch
              checked={explodeEnabled}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setExplodeEnabled(event.target.checked)}
              aria-label="Explode view"
            />
            <Slider
              min={0}
              max={1.5}
              step={0.05}
              value={explodeDistance}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setExplodeDistance(Number(event.target.value))}
            />
          </div>
          <div className="shelf-tool">
            <label>Clip box</label>
            <Switch
              checked={clipEnabled}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setClipEnabled(event.target.checked)}
              aria-label="Clip box"
            />
            <div className="female-anatomy-clip">
              <Select
                value={clipAxis}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setClipAxis(event.target.value as "x" | "y" | "z")
                }
              >
                <option value="x">X axis</option>
                <option value="y">Y axis</option>
                <option value="z">Z axis</option>
              </Select>
              <Slider
                min={0}
                max={1}
                step={0.02}
                value={clipValue}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setClipValue(Number(event.target.value))}
              />
            </div>
          </div>
          <div className="shelf-tool">
            <label>Search / isolate</label>
            <Input
              type="text"
              placeholder="Search structure"
              value={searchQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
            />
            <div className="female-anatomy-search-results">
              {searchableMeshes.map((name) => (
                <Button
                  key={name}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={isolateTarget === name ? "active" : ""}
                  onClick={() => handleSelectMesh(name)}
                >
                  {name}
                </Button>
              ))}
            </div>
            {isolateTarget && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsolateTarget("")}
              >
                Clear isolation
              </Button>
            )}
          </div>
          <div className="shelf-tool">
            <label>Label pinning</label>
            <Switch
              checked={labelEnabled}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setLabelEnabled(event.target.checked)}
              aria-label="Label pinning"
            />
          </div>
          <div className="shelf-note">
            <h4>Performance safeguards</h4>
            <ul>
              <li>Progressive loading (low to high)</li>
              <li>Auto-unload hidden layers</li>
              <li>Frame throttling on interaction</li>
            </ul>
          </div>
        </aside>
        )}
      </div>
    </div>
  );
};

export default FemaleAnatomyPage;
