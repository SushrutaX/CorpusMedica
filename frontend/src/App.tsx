import { useCallback, useEffect, useMemo, useState } from "react";
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

type UploadResponse = {
  filename: string;
  saved_path: string;
};

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

type Notice = {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
};

const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";

const SKELETONS = Array.from({ length: 3 }, (_, index) => index);
const buildDownloadUrl = (path: string) =>
  `${API_BASE}/api/download?path=${encodeURIComponent(path)}`;

export default function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState<boolean>(false);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [jobId, setJobId] = useState<string>("");
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [jobResult, setJobResult] = useState<ResultsResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [notices, setNotices] = useState<Notice[]>([]);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) || null,
    [models, selectedModelId]
  );
  const availableModels = useMemo(
    () => models.filter((model) => model.available),
    [models]
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setUploadResult(null);
    setJobId("");
    setJobStatus(null);
    setJobResult(null);
    if (nextFile) {
      pushNotice("info", "Scan selected", `${nextFile.name} ready to upload.`);
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
    if (!file) {
      setError("Please select a file first.");
      pushNotice("error", "Upload blocked", "Select a scan file to upload.");
      return;
    }

    try {
      setError("");
      setUploading(true);

      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error(`Upload failed (${res.status})`);

      const data = (await res.json()) as UploadResponse;
      setUploadResult(data);
      pushNotice("success", "Upload complete", "Scan saved successfully.");
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
          <h1>MedAI Platform</h1>
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

        <div className={`dropzone ${file ? "has-file" : ""}`}>
          <input
            id="scan-upload"
            className="file-input"
            type="file"
            onChange={handleFileChange}
          />
          <label htmlFor="scan-upload">
            <div className="dropzone-main">
              <span className="dropzone-title">
                {file ? file.name : "Drop scan file here"}
              </span>
              <span className="dropzone-subtitle">
                {file
                  ? "Ready to upload"
                  : "NIfTI (.nii/.nii.gz) or zipped DICOM series"}
              </span>
            </div>
            <div className="dropzone-chips">
              <span className="chip">Drag and drop</span>
              <span className="chip">Max 500MB</span>
            </div>
          </label>
        </div>

        <div className="upload-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || uploading}
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
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>3. Run segmentation</h2>
            <p>Submit the job and monitor progress.</p>
          </div>
          <span className={`status-badge ${jobStatus ? `status-${jobStatus}` : ""}`}>
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
            <span className={`status-badge ${jobStatus ? `status-${jobStatus}` : ""}`}>
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
