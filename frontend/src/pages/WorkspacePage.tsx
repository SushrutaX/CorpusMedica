import { useEffect, useRef, useState } from "react";

type AxisKey = "sagittal" | "coronal" | "axial";
type MeshTool = "orbit" | "sculpt" | "carve" | "select" | "label";
type SliceColorMap = string;
type VolumeColorMap = string;
type ClipAxis = "x" | "y" | "z";
type MeshSource = "scan" | "mask";
type MeshMaterialPreset = string;
type OverlayMaterialPreset = string;
type MeshOverlayItem = {
  id: string;
  label: string;
  materialPreset?: OverlayMaterialPreset;
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
type WorkspacePageProps = Record<string, any>;

const WorkspacePage = (props: WorkspacePageProps) => {
  const {
    selectionLabel,
    selectionWarning,
    uploadPath,
    authUser,
    authRoleLabel,
    authDisplayName,
    handleLogout,
    enable3DViewer,
    viewerMode,
    setViewerMode,
    viewer3dMode,
    setViewer3dMode,
    showLeftShelf,
    setShowLeftShelf,
    showRightShelf,
    setShowRightShelf,
    handleFileChange,
    handleUpload,
    uploading,
    files,
    handleBackToWorkflow,
    workspaceShellRef,
    viewerError,
    viewerLoading,
    volumeInfo,
    axisSizes,
    sliceIndex,
    sliceRequestIndex,
    buildSliceUrl,
    imageRefs,
    renderOverlay,
    canvasRefs,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    setSliceIndex,
    viewer3dLoading,
    meshLoading,
    setViewerContainerRef,
    setMeshContainerRef,
    viewer3dError,
    meshError,
    leftPanelRef,
    rightPanelRef,
    panelPositions,
    panelSizes,
    beginPanelDrag,
    beginPanelResize,
    WORKSPACE_TOOLS,
    workspaceTool,
    setWorkspaceTool,
    brushSize,
    setBrushSize,
    overlayOpacity,
    setOverlayOpacity,
    handleUndo,
    handleClearSlice,
    handleClearAll,
    handleExportAnnotations,
    meshTool,
    setMeshTool,
    meshSculptEnabled,
    meshBrushSize,
    setMeshBrushSize,
    meshStrength,
    setMeshStrength,
    meshSelectionCount,
    meshPickedLabel,
    meshSelectionRadius,
    setMeshSelectionRadius,
    meshSelectionStrength,
    setMeshSelectionStrength,
    meshSelectionPrecision,
    setMeshSelectionPrecision,
    meshLabelEnabled,
    setMeshLabelEnabled,
    meshAnatomyEnabled,
    setMeshAnatomyEnabled,
    meshAnatomyPreset,
    setMeshAnatomyPreset,
    meshSignalEnabled,
    setMeshSignalEnabled,
    meshSignalSpeed,
    setMeshSignalSpeed,
    meshSignalTargetId,
    setMeshSignalTargetId,
    meshVertexCount,
    nudgeMeshSelection,
    clearMeshSelection,
    clearMeshLabel,
    meshExplodeEnabled,
    setMeshExplodeEnabled,
    meshCanSculpt,
    sliceColormap,
    setSliceColormap,
    SLICE_COLORMAPS,
    viewerChannel,
    setViewerChannel,
    channelLabels,
    volumeColormap,
    setVolumeColormap,
    VOLUME_COLORMAPS,
    volumeOpacity,
    setVolumeOpacity,
    clipEnabled,
    setClipEnabled,
    clipAxis,
    setClipAxis,
    clipValue,
    setClipValue,
    meshIso,
    setMeshIso,
    meshStep,
    setMeshStep,
    meshSource,
    setMeshSource,
    meshMaskAvailable,
    meshVolumeEnabled,
    setMeshVolumeEnabled,
    meshVolumeColormap,
    setMeshVolumeColormap,
    meshVolumeOpacity,
    setMeshVolumeOpacity,
    meshOpacity,
    setMeshOpacity,
    meshOverlayEnabled,
    setMeshOverlayEnabled,
    meshOverlayOpacity,
    setMeshOverlayOpacity,
    meshOverlayIso,
    setMeshOverlayIso,
    meshOverlayStep,
    setMeshOverlayStep,
    meshOverlayLockEnabled,
    setMeshOverlayLockEnabled,
    meshOverlayLockTarget,
    setMeshOverlayLockTarget,
    MAX_MESH_PARTS,
    meshGroupCount,
    setMeshGroupCount,
    meshMaterialPreset,
    setMeshMaterialPreset,
    MESH_MATERIAL_PRESETS,
    meshWireframe,
    setMeshWireframe,
    meshClipEnabled,
    setMeshClipEnabled,
    meshClipAxis,
    setMeshClipAxis,
    meshClipValue,
    setMeshClipValue,
    meshExplodeDistance,
    setMeshExplodeDistance,
    meshIsolateEnabled,
    setMeshIsolateEnabled,
    meshPartCount,
    meshActiveGroup,
    stepMeshActiveGroup,
    activePartOffset,
    updateActivePartOffset,
    resetPartOffsets,
    hasPartOffsets,
    requestMeshRebuild,
    handleAddLabel,
    labels,
    activeLabelId,
    setActiveLabelId,
    handleLabelUpdate,
    handleRemoveLabel,
    activeSliceCount,
    annotationSummary,
    labelMap,
    meshHint,
    activeAxis,
    notices,
    workspaceUploads,
    clearWorkspaceUploads,
    workspacePath,
    selectWorkspaceUpload,
    addWorkspaceUploadToOverlay,
    updateWorkspaceUpload,
    meshOverlayItems,
    activeMeshOverlayId,
    setActiveMeshOverlayId,
    MESH_OVERLAY_LIMIT,
    meshOverlayDropActive,
    setMeshOverlayDropActive,
    handleMeshOverlayDrop,
    handleMeshOverlayFilesChange,
    meshOverlayFiles,
    meshOverlayUploading,
    removeMeshOverlayItem,
    moveMeshOverlayItem,
    updateMeshOverlayItem,
    MESH_OVERLAY_MATERIAL_PRESETS,
  } = props;
  const activeWorkspaceItem =
    workspaceUploads.find((item: any) => item.path === workspacePath) ?? null;
  const [openMenu, setOpenMenu] = useState<
    "file" | "edit" | "view" | "annotate" | "render" | "help" | null
  >(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const overlayMaterialPresets =
    MESH_OVERLAY_MATERIAL_PRESETS as Array<{ id: string; label: string }>;
  const sliceColormaps = SLICE_COLORMAPS as Array<{ id: string; label: string }>;
  const volumeColormaps = VOLUME_COLORMAPS as Array<{ id: string; label: string }>;
  const overlayLockOptions = [
    { id: "base", label: "Base scan" },
    ...meshOverlayItems.map((item: MeshOverlayItem) => ({
      id: item.id,
      label: item.label || "Overlay",
    })),
  ];
  const overlayOrderMap = new Map<string, number>();
  (meshOverlayItems as Array<{ id: string }>).forEach((item, index) => {
    overlayOrderMap.set(item.id, index + 1);
  });

  const isEditableTarget = (target: EventTarget | null) => {
    if (!target || !(target instanceof HTMLElement)) {
      return false;
    }
    const tag = target.tagName.toLowerCase();
    return (
      target.isContentEditable ||
      tag === "input" ||
      tag === "textarea" ||
      tag === "select"
    );
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      const code = event.code;
      const meta = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      const alt = event.altKey;

      if (key === "escape") {
        setOpenMenu(null);
        return;
      }

      if (key === "f1") {
        event.preventDefault();
        if (shift) {
          window.location.assign("/docs/frontend/workspace");
        } else {
          window.location.assign("/docs");
        }
        setOpenMenu(null);
        return;
      }

      if (key === "?" && !meta && !alt) {
        event.preventDefault();
        window.alert(
          "Shortcuts: Ctrl+Shift drag to orbit, Shift+drag to pan, scroll to zoom. Use M/R + axis + drag to move/rotate meshes."
        );
        setOpenMenu(null);
        return;
      }

      if (meta && !shift && key === "o") {
        event.preventDefault();
        uploadInputRef.current?.click();
        setOpenMenu(null);
        return;
      }
      if (meta && !shift && key === "u") {
        event.preventDefault();
        handleUpload();
        setOpenMenu(null);
        return;
      }
      if (meta && shift && key === "w") {
        event.preventDefault();
        clearWorkspaceUploads();
        setOpenMenu(null);
        return;
      }
      if (meta && !shift && key === "e") {
        event.preventDefault();
        handleExportAnnotations();
        setOpenMenu(null);
        return;
      }
      if (meta && shift && key === "b") {
        event.preventDefault();
        handleBackToWorkflow();
        setOpenMenu(null);
        return;
      }
      if (meta && !shift && key === "z") {
        event.preventDefault();
        handleUndo();
        setOpenMenu(null);
        return;
      }
      if (meta && shift && key === "c") {
        event.preventDefault();
        handleClearSlice();
        setOpenMenu(null);
        return;
      }
      if (meta && shift && key === "a") {
        event.preventDefault();
        handleClearAll();
        setOpenMenu(null);
        return;
      }
      if (meta && shift && key === "m") {
        event.preventDefault();
        clearMeshSelection();
        setOpenMenu(null);
        return;
      }
      if (meta && shift && key === "l") {
        event.preventDefault();
        clearMeshLabel();
        setOpenMenu(null);
        return;
      }
      if (meta && shift && key === "r") {
        event.preventDefault();
        resetPartOffsets();
        setOpenMenu(null);
        return;
      }
      if (meta && shift && key === "k") {
        event.preventDefault();
        requestMeshRebuild();
        setOpenMenu(null);
        return;
      }

      if (alt && !shift && code === "Digit1") {
        event.preventDefault();
        setViewerMode("2d");
        setOpenMenu(null);
        return;
      }
      if (alt && !shift && code === "Digit2") {
        event.preventDefault();
        setViewerMode("3d");
        setOpenMenu(null);
        return;
      }
      if (alt && !shift && code === "Digit3") {
        event.preventDefault();
        setViewerMode("3d");
        setViewer3dMode("volume");
        setOpenMenu(null);
        return;
      }
      if (alt && !shift && code === "Digit4") {
        event.preventDefault();
        setViewerMode("3d");
        setViewer3dMode("mesh");
        setOpenMenu(null);
        return;
      }
      if (alt && !shift && key === "l") {
        event.preventDefault();
        setShowLeftShelf((prev: boolean) => !prev);
        setOpenMenu(null);
        return;
      }
      if (alt && !shift && key === "r") {
        event.preventDefault();
        setShowRightShelf((prev: boolean) => !prev);
        setOpenMenu(null);
        return;
      }
      if (alt && !shift && key === "w") {
        event.preventDefault();
        setMeshWireframe((prev: boolean) => !prev);
        setOpenMenu(null);
        return;
      }
      if (alt && !shift && key === "v") {
        event.preventDefault();
        setMeshVolumeEnabled((prev: boolean) => !prev);
        setOpenMenu(null);
        return;
      }
      if (alt && !shift && key === "t") {
        event.preventDefault();
        setMeshOverlayEnabled((prev: boolean) => !prev);
        setOpenMenu(null);
        return;
      }
      if (alt && !shift && key === "c") {
        event.preventDefault();
        setMeshClipEnabled((prev: boolean) => !prev);
        setOpenMenu(null);
        return;
      }
      if (alt && !shift && key === "x") {
        event.preventDefault();
        setMeshExplodeEnabled((prev: boolean) => !prev);
        setOpenMenu(null);
        return;
      }
      if (alt && !shift && key === "i") {
        event.preventDefault();
        if (meshPartCount > 1) {
          setMeshIsolateEnabled((prev: boolean) => !prev);
        }
        setOpenMenu(null);
        return;
      }

      if (shift && !meta && !alt && code.startsWith("Digit")) {
        const index = Number(code.replace("Digit", "")) - 1;
        const tool = WORKSPACE_TOOLS[index];
        if (tool) {
          event.preventDefault();
          setWorkspaceTool(tool.id);
          setOpenMenu(null);
          return;
        }
      }

      if (alt && shift && key === "q") {
        event.preventDefault();
        setMeshTool("orbit");
        setOpenMenu(null);
        return;
      }
      if (alt && shift && key === "w") {
        event.preventDefault();
        setMeshTool("sculpt");
        setOpenMenu(null);
        return;
      }
      if (alt && shift && key === "e") {
        event.preventDefault();
        setMeshTool("carve");
        setOpenMenu(null);
        return;
      }
      if (alt && shift && key === "r") {
        event.preventDefault();
        setMeshTool("select");
        setOpenMenu(null);
        return;
      }
      if (alt && shift && key === "t") {
        event.preventDefault();
        setMeshTool("label");
        setOpenMenu(null);
        return;
      }
      if (alt && shift && key === "l") {
        event.preventDefault();
        setMeshLabelEnabled((prev: boolean) => !prev);
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [
    WORKSPACE_TOOLS,
    clearMeshLabel,
    clearMeshSelection,
    clearWorkspaceUploads,
    handleBackToWorkflow,
    handleClearAll,
    handleClearSlice,
    handleExportAnnotations,
    handleUpload,
    handleUndo,
    meshPartCount,
    requestMeshRebuild,
    resetPartOffsets,
    setMeshClipEnabled,
    setMeshExplodeEnabled,
    setMeshIsolateEnabled,
    setMeshLabelEnabled,
    setMeshOverlayEnabled,
    setMeshTool,
    setMeshVolumeEnabled,
    setMeshWireframe,
    setOpenMenu,
    setShowLeftShelf,
    setShowRightShelf,
    setViewer3dMode,
    setViewerMode,
    setWorkspaceTool,
  ]);

  const toggleMenu = (
    name: "file" | "edit" | "view" | "annotate" | "render" | "help"
  ) => {
    setOpenMenu((prev) => (prev === name ? null : name));
  };

  return (
      <div className="workspace workspace-blender workspace-neo">
        <div className="ambient" aria-hidden="true" />
        <div className="workspace-topbar">
          <div className="workspace-brand">
            <span>Corpus Medica</span>
            <strong>Viewer Workspace</strong>
          </div>
          <div className="workspace-menu" ref={menuRef}>
            <div className="menu-group">
              <button
                type="button"
                className={`menu-button ${openMenu === "file" ? "active" : ""}`}
                onClick={() => toggleMenu("file")}
                aria-expanded={openMenu === "file"}
              >
                File
              </button>
              {openMenu === "file" && (
                <div className="menu-panel" role="menu">
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      uploadInputRef.current?.click();
                      setOpenMenu(null);
                    }}
                  >
                    Choose files
                    <span className="menu-shortcut">Ctrl+O</span>
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      handleUpload();
                      setOpenMenu(null);
                    }}
                    disabled={
                      uploading || files.length === 0 || Boolean(selectionWarning)
                    }
                  >
                    Upload selected
                    <span className="menu-shortcut">Ctrl+U</span>
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      clearWorkspaceUploads();
                      setOpenMenu(null);
                    }}
                    disabled={!workspaceUploads.length}
                  >
                    Clear workspace files
                    <span className="menu-shortcut">Ctrl+Shift+W</span>
                  </button>
                  <div className="menu-divider" />
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      handleExportAnnotations();
                      setOpenMenu(null);
                    }}
                    disabled={annotationSummary.total === 0}
                  >
                    Export annotations
                    <span className="menu-shortcut">Ctrl+E</span>
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      handleBackToWorkflow();
                      setOpenMenu(null);
                    }}
                  >
                    Back to overview
                    <span className="menu-shortcut">Ctrl+Shift+B</span>
                  </button>
                </div>
              )}
            </div>
            <div className="menu-group">
              <button
                type="button"
                className={`menu-button ${openMenu === "edit" ? "active" : ""}`}
                onClick={() => toggleMenu("edit")}
                aria-expanded={openMenu === "edit"}
              >
                Edit
              </button>
              {openMenu === "edit" && (
                <div className="menu-panel" role="menu">
                  <span className="menu-section">Annotations</span>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      handleUndo();
                      setOpenMenu(null);
                    }}
                  >
                    Undo
                    <span className="menu-shortcut">Ctrl+Z</span>
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      handleClearSlice();
                      setOpenMenu(null);
                    }}
                  >
                    Clear slice
                    <span className="menu-shortcut">Ctrl+Shift+C</span>
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      handleClearAll();
                      setOpenMenu(null);
                    }}
                  >
                    Clear all
                    <span className="menu-shortcut">Ctrl+Shift+A</span>
                  </button>
                  <div className="menu-divider" />
                  <span className="menu-section">Mesh edits</span>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      clearMeshSelection();
                      setOpenMenu(null);
                    }}
                    disabled={meshSelectionCount === 0}
                  >
                    Clear mesh selection
                    <span className="menu-shortcut">Ctrl+Shift+M</span>
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      clearMeshLabel();
                      setOpenMenu(null);
                    }}
                    disabled={!meshPickedLabel}
                  >
                    Clear mesh label
                    <span className="menu-shortcut">Ctrl+Shift+L</span>
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      resetPartOffsets();
                      setOpenMenu(null);
                    }}
                    disabled={!hasPartOffsets}
                  >
                    Reset part offsets
                    <span className="menu-shortcut">Ctrl+Shift+R</span>
                  </button>
                </div>
              )}
            </div>
            <div className="menu-group">
              <button
                type="button"
                className={`menu-button ${openMenu === "view" ? "active" : ""}`}
                onClick={() => toggleMenu("view")}
                aria-expanded={openMenu === "view"}
              >
                View
              </button>
              {openMenu === "view" && (
                <div className="menu-panel" role="menu">
                  <span className="menu-section">Viewer</span>
                  <button
                    type="button"
                    className={`menu-item ${
                      viewerMode === "2d" ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setViewerMode("2d");
                      setOpenMenu(null);
                    }}
                  >
                    2D slices
                    <span className="menu-shortcut">Alt+1</span>
                  </button>
                  <button
                    type="button"
                    className={`menu-item ${
                      viewerMode === "3d" ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setViewerMode("3d");
                      setOpenMenu(null);
                    }}
                  >
                    3D viewer
                    <span className="menu-shortcut">Alt+2</span>
                  </button>
                  {viewerMode === "3d" && (
                    <>
                      <button
                        type="button"
                        className={`menu-item ${
                          viewer3dMode === "volume" ? "is-active" : ""
                        }`}
                        onClick={() => {
                          setViewer3dMode("volume");
                          setOpenMenu(null);
                        }}
                      >
                        Volume mode
                        <span className="menu-shortcut">Alt+3</span>
                      </button>
                      <button
                        type="button"
                        className={`menu-item ${
                          viewer3dMode === "mesh" ? "is-active" : ""
                        }`}
                        onClick={() => {
                          setViewer3dMode("mesh");
                          setOpenMenu(null);
                        }}
                      >
                        Mesh mode
                        <span className="menu-shortcut">Alt+4</span>
                      </button>
                    </>
                  )}
                  <div className="menu-divider" />
                  <span className="menu-section">Shelves</span>
                  <button
                    type="button"
                    className={`menu-item ${
                      showLeftShelf ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setShowLeftShelf((prev: boolean) => !prev);
                      setOpenMenu(null);
                    }}
                  >
                    {showLeftShelf ? "Hide left shelf" : "Show left shelf"}
                    <span className="menu-shortcut">Alt+L</span>
                  </button>
                  <button
                    type="button"
                    className={`menu-item ${
                      showRightShelf ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setShowRightShelf((prev: boolean) => !prev);
                      setOpenMenu(null);
                    }}
                  >
                    {showRightShelf ? "Hide right shelf" : "Show right shelf"}
                    <span className="menu-shortcut">Alt+R</span>
                  </button>
                  <div className="menu-divider" />
                  <button
                    type="button"
                    className={`menu-item ${
                      meshWireframe ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setMeshWireframe(!meshWireframe);
                      setOpenMenu(null);
                    }}
                  >
                    Wireframe
                    <span className="menu-shortcut">Alt+W</span>
                  </button>
                </div>
              )}
            </div>
            <div className="menu-group">
              <button
                type="button"
                className={`menu-button ${openMenu === "annotate" ? "active" : ""}`}
                onClick={() => toggleMenu("annotate")}
                aria-expanded={openMenu === "annotate"}
              >
                Annotate
              </button>
              {openMenu === "annotate" && (
                <div className="menu-panel" role="menu">
                  <span className="menu-section">2D tools</span>
                  {WORKSPACE_TOOLS.map(
                    (tool: { id: string; label: string }, index: number) => (
                      <button
                        key={tool.id}
                        type="button"
                        className={`menu-item ${
                          workspaceTool === tool.id ? "is-active" : ""
                        }`}
                        onClick={() => {
                          setWorkspaceTool(tool.id);
                          setOpenMenu(null);
                        }}
                      >
                        {tool.label}
                        <span className="menu-shortcut">
                          Shift+{index + 1}
                        </span>
                      </button>
                    )
                  )}
                  <div className="menu-divider" />
                  <span className="menu-section">3D mesh tools</span>
                  {(
                    [
                      {
                        id: "orbit",
                        label: "Orbit",
                        shortcut: "Alt+Shift+Q",
                      },
                      {
                        id: "sculpt",
                        label: "Sculpt",
                        shortcut: "Alt+Shift+W",
                      },
                      {
                        id: "carve",
                        label: "Carve",
                        shortcut: "Alt+Shift+E",
                      },
                      {
                        id: "select",
                        label: "Select",
                        shortcut: "Alt+Shift+R",
                      },
                      {
                        id: "label",
                        label: "Label",
                        shortcut: "Alt+Shift+T",
                      },
                    ] as Array<{ id: MeshTool; label: string; shortcut: string }>
                  ).map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      className={`menu-item ${
                        meshTool === tool.id ? "is-active" : ""
                      }`}
                      onClick={() => {
                        setMeshTool(tool.id);
                        setOpenMenu(null);
                      }}
                    >
                      {tool.label}
                      <span className="menu-shortcut">{tool.shortcut}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`menu-item ${
                      meshLabelEnabled ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setMeshLabelEnabled(!meshLabelEnabled);
                      setOpenMenu(null);
                    }}
                  >
                    Toggle mesh labels
                    <span className="menu-shortcut">Alt+Shift+L</span>
                  </button>
                </div>
              )}
            </div>
            <div className="menu-group">
              <button
                type="button"
                className={`menu-button ${openMenu === "render" ? "active" : ""}`}
                onClick={() => toggleMenu("render")}
                aria-expanded={openMenu === "render"}
              >
                Render
              </button>
              {openMenu === "render" && (
                <div className="menu-panel" role="menu">
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      requestMeshRebuild();
                      setOpenMenu(null);
                    }}
                  >
                    Rebuild mesh
                    <span className="menu-shortcut">Ctrl+Shift+K</span>
                  </button>
                  <div className="menu-divider" />
                  <span className="menu-section">Layers</span>
                  <button
                    type="button"
                    className={`menu-item ${
                      meshVolumeEnabled ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setMeshVolumeEnabled(!meshVolumeEnabled);
                      setOpenMenu(null);
                    }}
                  >
                    Volume underlay
                    <span className="menu-shortcut">Alt+V</span>
                  </button>
                  <button
                    type="button"
                    className={`menu-item ${
                      meshOverlayEnabled ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setMeshOverlayEnabled(!meshOverlayEnabled);
                      setOpenMenu(null);
                    }}
                  >
                    Tumor overlay
                    <span className="menu-shortcut">Alt+T</span>
                  </button>
                  <div className="menu-divider" />
                  <span className="menu-section">Effects</span>
                  <button
                    type="button"
                    className={`menu-item ${
                      meshClipEnabled ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setMeshClipEnabled(!meshClipEnabled);
                      setOpenMenu(null);
                    }}
                  >
                    Clipping
                    <span className="menu-shortcut">Alt+C</span>
                  </button>
                  <button
                    type="button"
                    className={`menu-item ${
                      meshExplodeEnabled ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setMeshExplodeEnabled(!meshExplodeEnabled);
                      setOpenMenu(null);
                    }}
                  >
                    Explode view
                    <span className="menu-shortcut">Alt+X</span>
                  </button>
                  <button
                    type="button"
                    className={`menu-item ${
                      meshIsolateEnabled ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setMeshIsolateEnabled(!meshIsolateEnabled);
                      setOpenMenu(null);
                    }}
                    disabled={meshPartCount <= 1}
                  >
                    Isolate part
                    <span className="menu-shortcut">Alt+I</span>
                  </button>
                </div>
              )}
            </div>
            <div className="menu-group">
              <button
                type="button"
                className={`menu-button ${openMenu === "help" ? "active" : ""}`}
                onClick={() => toggleMenu("help")}
                aria-expanded={openMenu === "help"}
              >
                Help
              </button>
              {openMenu === "help" && (
                <div className="menu-panel menu-panel-right" role="menu">
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      window.location.assign("/docs");
                      setOpenMenu(null);
                    }}
                  >
                    Documentation
                    <span className="menu-shortcut">F1</span>
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      window.location.assign("/docs/frontend/workspace");
                      setOpenMenu(null);
                    }}
                  >
                    Workspace guide
                    <span className="menu-shortcut">Shift+F1</span>
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      window.alert(
                        "Shortcuts: Ctrl+Shift drag to orbit, Shift+drag to pan, scroll to zoom. Use M/R + axis + drag to move/rotate meshes."
                      );
                      setOpenMenu(null);
                    }}
                  >
                    Keyboard shortcuts
                    <span className="menu-shortcut">?</span>
                  </button>
                </div>
              )}
            </div>
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
            {enable3DViewer && viewerMode === "3d" && (
              <div className="mode-toggle">
                <button
                  type="button"
                  className={viewer3dMode === "volume" ? "active" : ""}
                  onClick={() => setViewer3dMode("volume")}
                >
                  Volume
                </button>
                <button
                  type="button"
                  className={viewer3dMode === "mesh" ? "active" : ""}
                  onClick={() => setViewer3dMode("mesh")}
                >
                  Mesh
                </button>
              </div>
            )}
            <div className="workspace-shelf-toggle">
              <button
                type="button"
                className={showLeftShelf ? "active" : ""}
                onClick={() => setShowLeftShelf((prev: boolean) => !prev)}
                aria-pressed={showLeftShelf}
              >
                {showLeftShelf ? "Hide left" : "Show left"}
              </button>
              <button
                type="button"
                className={showRightShelf ? "active" : ""}
                onClick={() => setShowRightShelf((prev: boolean) => !prev)}
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
                ref={uploadInputRef}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="btn btn-accent btn-small"
                onClick={handleUpload}
                disabled={uploading || files.length === 0 || Boolean(selectionWarning)}
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={handleBackToWorkflow}
              >
                Back
              </button>
            </div>
          </div>
        </div>

        <div className="workspace-shell" ref={workspaceShellRef}>
          <main className="workspace-viewport">
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
                              setSliceIndex((prev: Record<AxisKey, number>) => ({
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
                      <div
                        className="viewer-3d-canvas"
                        ref={setViewerContainerRef}
                      />
                    )}
                    {viewer3dMode === "mesh" && (
                      <div
                        className={`viewer-3d-canvas viewer-3d-mesh viewer-3d-mesh-${meshTool}`}
                        ref={setMeshContainerRef}
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
                        {WORKSPACE_TOOLS.map((tool: { id: string; label: string }) => (
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
                        { id: "label", label: "Label" },
                        { id: "select", label: "Select" },
                        { id: "sculpt", label: "Sculpt" },
                        { id: "carve", label: "Carve" },
                        ] as Array<{ id: MeshTool; label: string }>).map(
                        (tool: { id: MeshTool; label: string }) => (
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
                          disabled={
                            !meshSculptEnabled ||
                            meshTool === "select" ||
                            meshTool === "label"
                          }
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
                          disabled={
                            !meshSculptEnabled ||
                            meshTool === "select" ||
                            meshTool === "label"
                          }
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
                      <div className="mesh-selection-label">
                        <span>Selected region</span>
                        <strong>
                          {meshPickedLabel || "Click a part to identify it"}
                        </strong>
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
                      <label className="mesh-selection-toggle">
                        <input
                          type="checkbox"
                          checked={meshLabelEnabled}
                          onChange={(event) =>
                            setMeshLabelEnabled(event.target.checked)
                          }
                        />
                        <span>Show label overlay</span>
                      </label>
                      <label className="mesh-selection-toggle">
                        <input
                          type="checkbox"
                          checked={meshAnatomyEnabled}
                          onChange={(event) =>
                            setMeshAnatomyEnabled(event.target.checked)
                          }
                        />
                        <span>Atlas label assist (experimental)</span>
                      </label>
                      {meshAnatomyEnabled && (
                        <div className="workspace-control">
                          <label>
                            Anatomy preset
                            <select
                              value={meshAnatomyPreset}
                              onChange={(event) =>
                                setMeshAnatomyPreset(
                                  event.target.value as typeof meshAnatomyPreset
                                )
                              }
                            >
                              <option value="brain">Brain atlas</option>
                              <option value="breast">Breast layers</option>
                              <option value="abdomen">Abdominal organs</option>
                              <option value="generic">Generic regions</option>
                            </select>
                          </label>
                        </div>
                      )}
                      <button
                        type="button"
                        className={`btn btn-secondary btn-small ${
                          meshSignalEnabled ? "is-active" : ""
                        }`}
                        onClick={() => setMeshSignalEnabled(!meshSignalEnabled)}
                      >
                        Blood vessel animation
                      </button>
                      {meshSignalEnabled && (
                        <>
                          <div className="workspace-control">
                            <label>
                              Animate file
                              <select
                                value={meshSignalTargetId}
                                onChange={(event) => {
                                  const targetPath = event.target.value;
                                  setMeshSignalTargetId(targetPath);
                                  if (targetPath && targetPath !== workspacePath) {
                                    selectWorkspaceUpload(targetPath);
                                  }
                                }}
                              >
                                {workspaceUploads.map((item: any) => (
                                  <option key={item.path} value={item.path}>
                                    {item.label || item.path || "Workspace file"}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="workspace-control">
                            <label>
                              Animation speed
                              <input
                                type="range"
                                min={0.4}
                                max={2.5}
                                step={0.1}
                                value={meshSignalSpeed}
                                onChange={(event) =>
                                  setMeshSignalSpeed(Number(event.target.value))
                                }
                              />
                            </label>
                            <strong>{meshSignalSpeed.toFixed(1)}x</strong>
                          </div>
                        </>
                      )}
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
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={clearMeshLabel}
                          disabled={!meshPickedLabel}
                        >
                          Clear label
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
                <div className="workspace-card">
                  <div className="workspace-card-head">
                    <h3>Workspace files</h3>
                    <div className="workspace-card-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                        }}
                        onClick={() => {
                          if (workspaceUploads.length === 0) return;
                          clearWorkspaceUploads();
                        }}
                        disabled={workspaceUploads.length === 0}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {workspaceUploads.length === 0 ? (
                    <p className="muted">No uploads yet. Add files to begin.</p>
                  ) : (
                    <div className="workspace-file-list">
                      {workspaceUploads.map((item: any, index: number) => {
                        const isActive = item.path === workspacePath;
                        return (
                          <div className="workspace-file-row" key={item.path}>
                            <button
                              type="button"
                              className={`workspace-file ${isActive ? "active" : ""}`}
                              onClick={() => selectWorkspaceUpload(index)}
                            >
                              <span className="workspace-file-name">
                                {item.label}
                              </span>
                              <span className="workspace-file-meta">
                                {item.kind.toUpperCase()}
                              </span>
                            </button>
                            <div className="workspace-file-actions">
                              <button
                                type="button"
                                className="btn btn-ghost btn-small"
                                onClick={() => addWorkspaceUploadToOverlay(item)}
                              >
                                Overlay
                              </button>
                              <label className="workspace-file-toggle">
                                <input
                                  type="checkbox"
                                  checked={item.visible ?? true}
                                  onChange={(event) =>
                                    updateWorkspaceUpload(item.path, {
                                      visible: event.target.checked,
                                    })
                                  }
                                />
                                <span>Visible</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {activeWorkspaceItem && (
                    <div className="workspace-file-transform">
                      <div className="mesh-overlay-transform">
                        <div className="mesh-overlay-transform-row">
                          <span>Move</span>
                          {(["X", "Y", "Z"] as const).map((axis, idx) => {
                            const position =
                              activeWorkspaceItem.position ?? [0, 0, 0];
                            return (
                              <label key={axis}>
                                {axis}
                                <input
                                  type="number"
                                  step={1}
                                  value={position[idx] ?? 0}
                                  onChange={(event) => {
                                    const next = [...position] as [
                                      number,
                                      number,
                                      number,
                                    ];
                                    next[idx] = Number(event.target.value);
                                    updateWorkspaceUpload(activeWorkspaceItem.path, {
                                      position: next,
                                    });
                                  }}
                                />
                              </label>
                            );
                          })}
                        </div>
                        <div className="mesh-overlay-transform-row">
                          <span>Rotate</span>
                          {(["X", "Y", "Z"] as const).map((axis, idx) => {
                            const rotation =
                              activeWorkspaceItem.rotation ?? [0, 0, 0];
                            return (
                              <label key={axis}>
                                {axis}
                                <input
                                  type="number"
                                  step={1}
                                  value={rotation[idx] ?? 0}
                                  onChange={(event) => {
                                    const next = [...rotation] as [
                                      number,
                                      number,
                                      number,
                                    ];
                                    next[idx] = Number(event.target.value);
                                    updateWorkspaceUpload(activeWorkspaceItem.path, {
                                      rotation: next,
                                    });
                                  }}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {viewerMode === "3d" && viewer3dMode === "mesh" && (
                  <div className="workspace-card">
                    <div className="workspace-card-head">
                      <h3>Overlay stack</h3>
                      <span className="mesh-overlay-count">
                        {meshOverlayItems.length}/{MESH_OVERLAY_LIMIT}
                      </span>
                    </div>
                    <div
                      className={`workspace-dropzone ${
                        meshOverlayDropActive ? "is-active" : ""
                      }`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setMeshOverlayDropActive(true);
                      }}
                      onDragLeave={() => setMeshOverlayDropActive(false)}
                      onDrop={handleMeshOverlayDrop}
                    >
                      <input
                        id="mesh-overlay-upload"
                        type="file"
                        multiple
                        onChange={handleMeshOverlayFilesChange}
                      />
                      <label htmlFor="mesh-overlay-upload">
                        <div className="dropzone-main">
                          <span className="dropzone-title">Drop volumes here</span>
                          <span className="dropzone-subtitle">
                            MRI/MRA NIfTI or zip archives (up to {MESH_OVERLAY_LIMIT})
                          </span>
                          {meshOverlayFiles.length > 0 && (
                            <div className="dropzone-chips">
                              <span className="chip">
                                {meshOverlayFiles.length} file(s) queued
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="chip">
                          {meshOverlayUploading ? "Uploading..." : "Add files"}
                        </span>
                      </label>
                    </div>
                    {meshOverlayItems.length === 0 ? (
                      <p className="muted">No overlay volumes yet.</p>
                    ) : (
                      <div className="mesh-overlay-list">
                        {meshOverlayItems.map((item: MeshOverlayItem) => {
                          const isActive = activeMeshOverlayId === item.id;
                          return (
                            <div
                              className={`mesh-overlay-item ${isActive ? "is-active" : ""}`}
                              key={item.id}
                              onClick={() => setActiveMeshOverlayId(item.id)}
                            >
                              <div className="mesh-overlay-head">
                                <div className="mesh-overlay-title">
                                  <strong>{item.label}</strong>
                                  <span className="mesh-overlay-order">
                                    Stack #{overlayOrderMap.get(item.id) ?? 1}
                                  </span>
                                  {isActive && (
                                    <span className="chip chip-active">Active</span>
                                  )}
                                </div>
                                <div className="mesh-overlay-order-actions">
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-small"
                                    onClick={() => moveMeshOverlayItem(item.id, "up")}
                                    disabled={overlayOrderMap.get(item.id) === 1}
                                  >
                                    Up
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-small"
                                    onClick={() => moveMeshOverlayItem(item.id, "down")}
                                    disabled={
                                      overlayOrderMap.get(item.id) ===
                                      overlayOrderMap.size
                                    }
                                  >
                                    Down
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-small"
                                    onClick={() => removeMeshOverlayItem(item.id)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                              <div className="mesh-overlay-controls">
                                <label>
                                  Material
                                  <select
                                    value={item.materialPreset ?? "brain"}
                                    onChange={(event) =>
                                      updateMeshOverlayItem(item.id, {
                                        materialPreset: event.target
                                          .value as OverlayMaterialPreset,
                                      })
                                    }
                                  >
                                    {overlayMaterialPresets.map((preset) => (
                                      <option key={preset.id} value={preset.id}>
                                        {preset.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  Render
                                  <select
                                    value={item.renderMode ?? "volume"}
                                    onChange={(event) =>
                                      updateMeshOverlayItem(item.id, {
                                        renderMode: event.target
                                          .value as MeshOverlayItem["renderMode"],
                                      })
                                    }
                                  >
                                    <option value="volume">Volume</option>
                                    <option value="mesh">Mesh</option>
                                  </select>
                                </label>
                                <label>
                                  Opacity
                                  <input
                                    type="range"
                                    min={0.1}
                                    max={1}
                                    step={0.05}
                                    value={item.opacity}
                                    onChange={(event) =>
                                      updateMeshOverlayItem(item.id, {
                                        opacity: Number(event.target.value),
                                      })
                                    }
                                  />
                                </label>
                                <div className="mesh-overlay-transform">
                                  <div className="mesh-overlay-transform-row">
                                    <span>Move</span>
                                    {(["X", "Y", "Z"] as const).map((axis, idx) => {
                                      const position = item.position ?? [0, 0, 0];
                                      return (
                                        <label key={axis}>
                                          {axis}
                                          <input
                                            type="number"
                                            step={1}
                                            value={position[idx] ?? 0}
                                            onChange={(event) => {
                                              const next = [...position] as [
                                                number,
                                                number,
                                                number,
                                              ];
                                              next[idx] = Number(event.target.value);
                                              updateMeshOverlayItem(item.id, {
                                                position: next,
                                              });
                                            }}
                                          />
                                        </label>
                                      );
                                    })}
                                  </div>
                                  <div className="mesh-overlay-transform-row">
                                    <span>Rotate</span>
                                    {(["X", "Y", "Z"] as const).map((axis, idx) => {
                                      const rotation = item.rotation ?? [0, 0, 0];
                                      return (
                                        <label key={axis}>
                                          {axis}
                                          <input
                                            type="number"
                                            step={1}
                                            value={rotation[idx] ?? 0}
                                            onChange={(event) => {
                                              const next = [...rotation] as [
                                                number,
                                                number,
                                                number,
                                              ];
                                              next[idx] = Number(event.target.value);
                                              updateMeshOverlayItem(item.id, {
                                                rotation: next,
                                              });
                                            }}
                                          />
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="mesh-overlay-transform">
                                  <div className="mesh-overlay-transform-row">
                                    <span>Clip</span>
                                    <label className="mesh-overlay-toggle">
                                      <input
                                        type="checkbox"
                                        checked={item.clipEnabled ?? false}
                                        onChange={(event) => {
                                          const enabled = event.target.checked;
                                          const next: Partial<MeshOverlayItem> = {
                                            clipEnabled: enabled,
                                          };
                                          if (
                                            enabled &&
                                            (item.clipValue === undefined ||
                                              item.clipValue === null ||
                                              (!item.clipEnabled && item.clipValue === 0.5))
                                          ) {
                                            next.clipValue = 0;
                                          }
                                          updateMeshOverlayItem(item.id, next);
                                        }}
                                      />
                                      <span>Enable</span>
                                    </label>
                                    <label>
                                      Axis
                                      <select
                                        value={item.clipAxis ?? "z"}
                                        onChange={(event) =>
                                          updateMeshOverlayItem(item.id, {
                                            clipAxis: event.target.value as ClipAxis,
                                          })
                                        }
                                      >
                                        <option value="x">X</option>
                                        <option value="y">Y</option>
                                        <option value="z">Z</option>
                                      </select>
                                    </label>
                                    <label>
                                      Slice
                                      <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.02}
                                        value={item.clipValue ?? 0}
                                        onChange={(event) =>
                                          updateMeshOverlayItem(item.id, {
                                            clipValue: Number(event.target.value),
                                          })
                                        }
                                      />
                                    </label>
                                  </div>
                                  <div className="mesh-overlay-transform-row">
                                    <span>Explode</span>
                                    <label className="mesh-overlay-toggle">
                                      <input
                                        type="checkbox"
                                        checked={item.explodeEnabled ?? false}
                                        onChange={(event) =>
                                          updateMeshOverlayItem(item.id, {
                                            explodeEnabled: event.target.checked,
                                          })
                                        }
                                      />
                                      <span>Enable</span>
                                    </label>
                                    <label>
                                      Distance
                                      <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={item.explodeDistance ?? 0.25}
                                        onChange={(event) =>
                                          updateMeshOverlayItem(item.id, {
                                            explodeDistance: Number(event.target.value),
                                          })
                                        }
                                      />
                                    </label>
                                  </div>
                                </div>
                              </div>
                              <label className="mesh-overlay-toggle">
                                <input
                                  type="checkbox"
                                  checked={item.visible}
                                  onChange={(event) =>
                                    updateMeshOverlayItem(item.id, {
                                      visible: event.target.checked,
                                    })
                                  }
                                />
                                <span>Visible</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
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
                            {sliceColormaps.map((map) => (
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
                              {channelLabels.map((label: string, index: number) => (
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
                            {volumeColormaps.map((map) => (
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
                              {channelLabels.map((label: string, index: number) => (
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
                          <span>Volume underlay</span>
                          <div className="clip-toggle">
                            <input
                              type="checkbox"
                              checked={meshVolumeEnabled}
                              onChange={(event) =>
                                setMeshVolumeEnabled(event.target.checked)
                              }
                            />
                            <span className="viewer-control-value">
                              {meshVolumeEnabled ? "On" : "Off"}
                            </span>
                          </div>
                          <span className="viewer-control-note">
                            Layer the original volume under the mesh to inspect internal
                            structures.
                          </span>
                        </label>
                        {meshVolumeEnabled && (
                          <>
                            <label className="viewer-control">
                              <span>Underlay colormap</span>
                              <select
                                value={meshVolumeColormap}
                                onChange={(event) =>
                                  setMeshVolumeColormap(
                                    event.target.value as VolumeColorMap
                                  )
                                }
                              >
                                {volumeColormaps.map((colormap) => (
                                  <option key={colormap.id} value={colormap.id}>
                                    {colormap.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="viewer-control">
                              <span>Underlay opacity</span>
                              <input
                                type="range"
                                min={0}
                                max={0.6}
                                step={0.02}
                                value={meshVolumeOpacity}
                                onChange={(event) =>
                                  setMeshVolumeOpacity(
                                    Number(event.target.value)
                                  )
                                }
                              />
                              <span className="viewer-control-value">
                                {meshVolumeOpacity.toFixed(2)}
                              </span>
                            </label>
                          </>
                        )}
                        <label className="viewer-control">
                          <span>Mesh opacity</span>
                          <input
                            type="range"
                            min={0.2}
                            max={1}
                            step={0.05}
                            value={meshOpacity}
                            onChange={(event) =>
                              setMeshOpacity(Number(event.target.value))
                            }
                          />
                          <span className="viewer-control-value">
                            {meshOpacity.toFixed(2)}
                          </span>
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
                              <label className="viewer-control">
                                <span>Lock tumor to</span>
                                <div className="clip-toggle">
                                  <input
                                    type="checkbox"
                                    checked={meshOverlayLockEnabled}
                                    onChange={(event) =>
                                      setMeshOverlayLockEnabled(
                                        event.target.checked
                                      )
                                    }
                                  />
                                  <select
                                    value={meshOverlayLockTarget}
                                    onChange={(event) =>
                                      setMeshOverlayLockTarget(event.target.value)
                                    }
                                    disabled={!meshOverlayLockEnabled}
                                  >
                                    {overlayLockOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <span className="viewer-control-note">
                                  Keep the mask aligned to a chosen file while
                                  you reposition overlays.
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
                            {Object.entries(
                              MESH_MATERIAL_PRESETS as Record<
                                string,
                                { label: string }
                              >
                            ).map(([id, preset]) => (
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
                              {channelLabels.map((label: string, index: number) => (
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
                    {labels.map((label: any) => (
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
          {notices.map(
            (notice: {
              id: string;
              type: string;
              title: string;
              message: string;
            }) => (
              <div key={notice.id} className={`toast toast-${notice.type}`}>
                <strong>{notice.title}</strong>
                <p>{notice.message}</p>
              </div>
            )
          )}
        </div>
      </div>
  );
};

export default WorkspacePage;
