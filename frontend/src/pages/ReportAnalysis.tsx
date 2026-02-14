import { useCallback, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { LabMarkerIcon } from "../components/LabMarkerIcon";
import "./ReportAnalysis.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";
const AUTH_TOKEN_KEY = "medai_auth_token";
const REPORT_PATIENT_ID_KEY = "report_analysis_patient_id";

type ReportResponse = {
  report_id?: string;
  extracted_data?: {
    lab_values: Record<string, number>;
    demographics: { name?: string; age_years?: number; sex?: string; fasting_status?: string; patient_id?: string };
  };
  confidence_analysis?: {
    overall_confidence: number;
    confidence_level: string;
    components: unknown;
    recommendations: string[];
  };
  risk_analysis: {
    risk_level: string;
    abnormalities: Record<string, { value: number; status: string; interpretation?: string } | string>;
    prioritized_abnormalities?: Array<{
      test_name: string;
      value: number;
      status: string;
      priority: { priority_score: number; urgency: string };
    }>;
    risk_clusters?: {
      detected_clusters: Array<{ pattern_name: string; description: string; severity: string }>;
      cluster_count: number;
    };
    explanations: string[];
    possible_symptoms: string[];
    disclaimer?: string;
  };
  llm_explanation: string;
  doctor_discussion_prompts?: {
    prompts: { critical_questions: string[]; high_priority_questions: string[]; general_questions: string[]; follow_up_questions: string[] };
    guidance: string;
  };
  procedure_risks?: {
    overall_procedure_risk: string;
    flagged_risks: Array<{ risk_type: string; description: string; recommendation: string }>;
    recommendations: string[];
  };
  digital_twin_inputs?: Record<string, unknown>;
  trend_analysis?: {
    summary?: { improving: number; worsening: number; stable: number; total_tests_with_trends?: number };
    trends?: Record<string, {
      test_name: string;
      current_value: number;
      trend_direction: string;
      average_percent_change: number;
      data_points: number;
      trends?: Array<{ direction: string; percent_change: number; previous_value: number; days_between: number }>;
    }>;
  };
  patient_id?: string;
  imaging_correlation?: { correlations: Array<{ type: string; lab_finding: string; imaging_finding: string; significance: string }>; insights: string[] };
};

export default function ReportAnalysis() {
  const [file, setFile] = useState<File | null>(null);
  const [secondFile, setSecondFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [patientId, setPatientId] = useState<string | null>(() => sessionStorage.getItem(REPORT_PATIENT_ID_KEY));
  const [openSection, setOpenSection] = useState<string | null>("values");
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);

  const labValues = useMemo(() => {
    const data = result?.extracted_data?.lab_values ?? (result as { extracted_values?: Record<string, number> })?.extracted_values;
    return Object.entries(data ?? {});
  }, [result]);

  const abnormalities = useMemo(() => {
    const abn = result?.risk_analysis?.abnormalities ?? {};
    return Object.entries(abn).map(([k, v]) => {
      const disp = typeof v === "string" ? v : (v?.interpretation ?? (v as { status?: string })?.status ?? "abnormal");
      return [k, disp] as const;
    });
  }, [result]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && /\.(txt|pdf|jpg|jpeg|png)$/i.test(f.name)) {
      setFile(f);
      setError("");
      setResult(null);
    } else {
      setError("Please upload a .txt, .pdf, .jpg, or .png file.");
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError("");
      setResult(null);
    }
  }, []);

  const analyze = useCallback(async (fileToAnalyze?: File) => {
    const f = fileToAnalyze ?? file;
    if (!f) {
      setError("Select a report file first.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      if (patientId) form.append("patient_id", patientId);

      const headers: Record<string, string> = {};
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/reports/analyze`, {
        method: "POST",
        body: form,
        credentials: "include",
        headers,
      });
      const data = (await res.json()) as ReportResponse | { detail?: string };
      if (!res.ok) {
        throw new Error("detail" in data && data.detail ? String(data.detail) : `Analysis failed (${res.status})`);
      }
      const payload = data as ReportResponse;
      setResult(payload);
      const nextPatientId = payload.patient_id ?? payload.report_id ?? patientId ?? null;
      setPatientId(nextPatientId);
      if (nextPatientId) sessionStorage.setItem(REPORT_PATIENT_ID_KEY, nextPatientId);
      setOpenSection("values");
      setShowUploadSection(true);
      if (fileToAnalyze) {
        setSecondFile(null);
        setFile(fileToAnalyze);
      } else {
        setFile(f);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report analysis failed.");
    } finally {
      setLoading(false);
    }
  }, [file, patientId]);

  const toggle = (id: string) => setOpenSection((s) => (s === id ? null : id));
  const isOpen = (id: string) => openSection === id;

  const downloadDigitalTwin = () => {
    if (!result?.digital_twin_inputs) return;
    const blob = new Blob([JSON.stringify(result.digital_twin_inputs, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `digital_twin_${result.report_id ?? "export"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const analyzeReportTrends = useCallback(async () => {
    const id = patientId ?? result?.patient_id ?? result?.report_id;
    if (!id) return;
    setTrendLoading(true);
    try {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/reports/trends/${encodeURIComponent(id)}`, { credentials: "include", headers });
      const data = (await res.json()) as { trends?: Record<string, unknown>; summary?: unknown; message?: string };
      if (!res.ok) throw new Error((data as { message?: string }).message ?? "Failed to load trends");
      setResult((prev) => (prev ? { ...prev, trend_analysis: data as ReportResponse["trend_analysis"] } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load trends.");
    } finally {
      setTrendLoading(false);
    }
  }, [patientId, result]);

  return (
    <div className="report-analysis-light" id="report-analysis">
      <div className="ra-container">
        <header className="ra-hero">
          <span className="ra-pill">Clinical report intelligence</span>
          <h1 className="ra-title">
            Report <span>Analysis</span>
          </h1>
          <p className="ra-lead">
            Upload lab reports (PDF, image, or TXT) to extract biomarkers, assess risk, and get insights.
          </p>
        </header>

        <section
          className={`ra-upload ${file ? "has-file" : ""} ${dragOver ? "ra-drag-over" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById("report-file-input")?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && document.getElementById("report-file-input")?.click()}
        >
          <input
            id="report-file-input"
            type="file"
            accept=".txt,.pdf,.jpg,.jpeg,.png"
            onChange={handleFileInput}
            style={{ display: "none" }}
          />
          {file ? (
            <p>📄 {file.name}</p>
          ) : (
            <p>Drop a lab report here or click to browse</p>
          )}
        </section>

        <div className="ra-form-row">
          <button
            type="button"
            className="ra-btn-analyze"
            onClick={() => analyze()}
            disabled={!file || loading}
          >
            {loading ? "Analyzing…" : "Analyze report"}
          </button>
        </div>

        {error && (
          <div role="alert" className="ra-error">
            {error}
          </div>
        )}

        {result && (
          <div className="ra-results-wrapper">
            {/* Summary cards */}
            <div className="ra-summary-grid">
              <SummaryCard
                label="Risk level"
                value={result.risk_analysis.risk_level}
                variant={result.risk_analysis.risk_level as "low" | "moderate" | "high" | "critical"}
              />
              <SummaryCard label="Values extracted" value={String(labValues.length)} />
              <SummaryCard label="Abnormalities" value={String(abnormalities.length)} />
              {result.confidence_analysis && (
                <SummaryCard
                  label="Confidence"
                  value={`${Math.round((result.confidence_analysis.overall_confidence ?? 0) * 100)}%`}
                  variant={result.confidence_analysis.confidence_level === "high" ? "low" : result.confidence_analysis.confidence_level === "medium" ? "moderate" : "high"}
                />
              )}
            </div>

            {/* Patient details at top: name, gender, age, sex */}
            {result.extracted_data?.demographics && (
              <div className="ra-patient-details-top">
                {(() => {
                  const d = result.extracted_data.demographics;
                  const hasName = !!d.name;
                  const hasGender = !!d.sex;
                  const hasAge = d.age_years != null;
                  const pid = (d as { patient_id?: string }).patient_id;
                  const hasPid = !!pid;
                  if (!hasName && !hasGender && !hasAge && !hasPid) {
                    return null;
                  }
                  return (
                    <div className="ra-patient-details-grid">
                      {hasName && (
                        <div className="ra-patient-detail-item">
                          <span className="ra-patient-detail-label">Name</span>
                          <span className="ra-patient-detail-value">{d.name}</span>
                        </div>
                      )}
                      {hasGender && (
                        <div className="ra-patient-detail-item">
                          <span className="ra-patient-detail-label">Gender</span>
                          <span className="ra-patient-detail-value">{d.sex}</span>
                        </div>
                      )}
                      {hasAge && (
                        <div className="ra-patient-detail-item">
                          <span className="ra-patient-detail-label">Age</span>
                          <span className="ra-patient-detail-value">{d.age_years} years</span>
                        </div>
                      )}
                      {hasPid && (
                        <div className="ra-patient-detail-item">
                          <span className="ra-patient-detail-label">Patient ID</span>
                          <span className="ra-patient-detail-value ra-mono">{pid}</span>
                        </div>
                      )}
                      {result.patient_id && (
                        <div className="ra-patient-detail-item">
                          <span className="ra-patient-detail-label">Report ID</span>
                          <span className="ra-patient-detail-value ra-mono">{result.patient_id}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Two-column layout: main + sidebar */}
            <div className="ra-layout">
              {/* Main column (left) */}
              <div className="ra-main-column">
                {/* Trend analysis block (always shown; button to analyze trends when no data yet) */}
                <TrendAnalysisBlock
                  result={result}
                  onAnalyzeTrends={analyzeReportTrends}
                  trendLoading={trendLoading}
                  patientId={patientId ?? result.patient_id ?? result.report_id ?? null}
                />

                {/* Extracted values block */}
                <div className="ra-block">
                  <h2 className="ra-block-title">Extracted values</h2>
                  {labValues.length ? (
                    <>
                      <div className="ra-lab-grid">
                        {labValues.map(([k, v]) => {
                          const abn = abnormalities.find(([key]) => key === k);
                          const isAbnormal = !!abn;
                          const statusText = abn ? abn[1] : "Normal";
                          const urgency = (result.risk_analysis.prioritized_abnormalities ?? []).find((a) => a.test_name.toLowerCase() === k.toLowerCase())?.priority?.urgency;
                          const statusClass = urgency === "critical" ? "ra-critical" : isAbnormal ? "ra-abnormal" : "ra-normal";
                          return (
                            <div key={k} className={`ra-lab-card ${isAbnormal ? "ra-abnormal" : ""}`}>
                              <div className="ra-lab-icon">
                                <LabMarkerIcon marker={k} isNormal={!isAbnormal} />
                              </div>
                              <div className="ra-lab-body">
                                <div className="ra-lab-marker">{k.replace(/_/g, " ")}</div>
                                <div className="ra-lab-value">{String(v)}</div>
                                <div className={`ra-lab-status ${statusClass}`}>{statusText}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="ra-muted">No structured values detected.</p>
                  )}
                </div>

                {/* Digital twin export dropdown */}
                {result.digital_twin_inputs && (
                  <Dropdown title="Digital twin export" isOpen={isOpen("digital")} onToggle={() => toggle("digital")}>
                    <p className="ra-muted" style={{ marginBottom: "0.75rem" }}>Data prepared for simulation models.</p>
                    <button type="button" className="ra-btn-secondary" onClick={downloadDigitalTwin}>
                      Download JSON
                    </button>
                  </Dropdown>
                )}

                {/* Doctor questions dropdown */}
                {result.doctor_discussion_prompts && (
                  <Dropdown title="Questions for your doctor" isOpen={isOpen("doctor")} onToggle={() => toggle("doctor")}>
                    {result.doctor_discussion_prompts.prompts.critical_questions?.length ? (
                      <div style={{ marginBottom: "1rem" }}>
                        <strong className="ra-critical-label">Critical</strong>
                        <ul style={{ marginTop: "0.25rem" }}>
                          {result.doctor_discussion_prompts.prompts.critical_questions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {result.doctor_discussion_prompts.prompts.high_priority_questions?.length ? (
                      <div style={{ marginBottom: "1rem" }}>
                        <strong>High priority</strong>
                        <ul style={{ marginTop: "0.25rem" }}>
                          {result.doctor_discussion_prompts.prompts.high_priority_questions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {result.doctor_discussion_prompts.prompts.general_questions?.length ? (
                      <div style={{ marginBottom: "1rem" }}>
                        <strong>General</strong>
                        <ul style={{ marginTop: "0.25rem" }}>
                          {result.doctor_discussion_prompts.prompts.general_questions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {result.doctor_discussion_prompts.guidance && (
                      <p className="ra-guidance">{result.doctor_discussion_prompts.guidance}</p>
                    )}
                  </Dropdown>
                )}

                {/* Scan & Imaging block (always shown, separate from Risk Clusters) */}
                <div className="ra-block">
                  <h2 className="ra-block-title">Scan &amp; Imaging</h2>
                  {result.imaging_correlation?.correlations?.length ? (
                    <>
                      <p className="ra-muted" style={{ marginBottom: "0.75rem" }}>Lab findings correlated with imaging (e.g. Brain MRI).</p>
                      {result.imaging_correlation.correlations.map((c, i) => (
                        <div key={i} className="ra-imaging-card">
                          <strong>{c.type}</strong>: {c.lab_finding} ↔ {c.imaging_finding}. {c.significance}
                        </div>
                      ))}
                      {result.imaging_correlation.insights?.length ? (
                        <ul className="ra-imaging-insights">
                          {result.imaging_correlation.insights.map((ins, i) => (
                            <li key={i}>{ins}</li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <p className="ra-muted">Link a scan (e.g. Brain MRI) with this report for integrated insights. Lab-based imaging correlation is shown when available.</p>
                  )}
                </div>

                {/* Risk Clusters block (always shown, separate from Scan & Imaging) */}
                <div className="ra-block">
                  <h2 className="ra-block-title">Risk Clusters</h2>
                  {result.risk_analysis.risk_clusters && result.risk_analysis.risk_clusters.cluster_count > 0 ? (
                    result.risk_analysis.risk_clusters.detected_clusters.map((c, i) => (
                      <div key={i} className="ra-cluster-card">
                        <div className="ra-cluster-name">{c.pattern_name.replace(/_/g, " ")}</div>
                        <p className="ra-cluster-desc">{c.description}</p>
                        <span className="ra-cluster-severity">{c.severity}</span>
                      </div>
                    ))
                  ) : (
                    <p className="ra-muted">No risk clusters detected for this report.</p>
                  )}
                </div>

                {/* Upload another report section (auto-shown after first analysis; button in main block) */}
                {showUploadSection && (
                  <div className="ra-block ra-upload-another-block">
                    <h2 className="ra-block-title">Add another report</h2>
                    <p className="ra-muted" style={{ marginBottom: "1rem" }}>Upload a follow-up report to compare and see trend of health conditions (same session links reports automatically).</p>
                    <section
                      className={`ra-upload ra-upload-secondary ${secondFile ? "has-file" : ""} ${dragOver ? "ra-drag-over" : ""}`}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const f = e.dataTransfer.files[0];
                        if (f && /\.(txt|pdf|jpg|jpeg|png)$/i.test(f.name)) {
                          setSecondFile(f);
                          setError("");
                        }
                      }}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                      onClick={() => document.getElementById("report-file-input-secondary")?.click()}
                      role="button"
                      tabIndex={0}
                    >
                      <input
                        id="report-file-input-secondary"
                        type="file"
                        accept=".txt,.pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setSecondFile(f);
                            setError("");
                          }
                        }}
                        style={{ display: "none" }}
                      />
                      {secondFile ? <p>📄 {secondFile.name}</p> : <p>Drop another report or click to browse</p>}
                    </section>
                    <button
                      type="button"
                      className="ra-btn-analyze"
                      style={{ marginTop: "1rem" }}
                      onClick={() => analyze(secondFile ?? undefined)}
                      disabled={!secondFile || loading}
                    >
                      {loading ? "Analyzing…" : "Analyze this report"}
                    </button>
                  </div>
                )}
              </div>

              {/* Sidebar (right) */}
              <aside className="ra-sidebar">
                {/* Report explanation */}
                <div className="ra-sidebar-section">
                  <h2 className="ra-sidebar-title">Report explanation</h2>
                  <div className="ra-explanation-text">
                    {result.llm_explanation}
                  </div>
                </div>

                {/* Summary details */}
                <div className="ra-sidebar-section">
                  <h2 className="ra-sidebar-title">Summary details</h2>
                  <div className="ra-details-list">
                    <div className="ra-detail-item">
                      <span className="ra-detail-label">Risk level</span>
                      <span className={`ra-detail-value ra-risk-${result.risk_analysis.risk_level}`}>
                        {result.risk_analysis.risk_level}
                      </span>
                    </div>
                    <div className="ra-detail-item">
                      <span className="ra-detail-label">Values extracted</span>
                      <span className="ra-detail-value">{labValues.length}</span>
                    </div>
                    <div className="ra-detail-item">
                      <span className="ra-detail-label">Abnormalities</span>
                      <span className="ra-detail-value">{abnormalities.length}</span>
                    </div>
                    {result.confidence_analysis && (
                      <div className="ra-detail-item">
                        <span className="ra-detail-label">Confidence</span>
                        <span className="ra-detail-value">
                          {`${Math.round((result.confidence_analysis.overall_confidence ?? 0) * 100)}%`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Disclaimer */}
                {result.risk_analysis.disclaimer && (
                  <div className="ra-sidebar-section ra-disclaimer">
                    <p>{result.risk_analysis.disclaimer}</p>
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrendAnalysisBlock({
  result,
  onAnalyzeTrends,
  trendLoading,
  patientId,
}: {
  result: ReportResponse;
  onAnalyzeTrends: () => void;
  trendLoading: boolean;
  patientId: string | null;
}) {
  const hasTrends = result.trend_analysis?.trends && Object.keys(result.trend_analysis.trends).length > 0;
  const trends = hasTrends ? Object.entries(result.trend_analysis!.trends!) : [];

  const chartData = trends
    .map(([name, t]) => {
      if (!t || typeof t !== "object") return null;
      const current = (t as { current_value?: number }).current_value ?? 0;
      const previous = (t as { trends?: Array<{ previous_value?: number }> }).trends?.[0]?.previous_value ?? 0;
      return { name: name.replace(/_/g, " "), current, previous };
    })
    .filter(Boolean) as Array<{ name: string; current: number; previous: number }>;

  return (
    <div className="ra-block ra-trend-block">
      <div className="ra-trend-header">
        <h2 className="ra-block-title">Trend analysis</h2>
        <button
          type="button"
          className="ra-btn-trend"
          onClick={onAnalyzeTrends}
          disabled={!patientId || trendLoading}
        >
          {trendLoading ? "Loading…" : "Analyze report trends"}
        </button>
      </div>

      {hasTrends ? (
        <>
          {result.trend_analysis!.summary && (
            <div className="ra-trend-pills">
              <span className="ra-trend-pill ra-improving">Improving: {result.trend_analysis!.summary.improving}</span>
              <span className="ra-trend-pill ra-worsening">Worsening: {result.trend_analysis!.summary.worsening}</span>
              <span className="ra-trend-pill ra-stable">Stable: {result.trend_analysis!.summary.stable}</span>
            </div>
          )}
          {chartData.length > 0 && (
            <div className="ra-trend-chart">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 232, 240, 0.5)" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 12 }}
                    stroke="rgba(100, 116, 139, 0.5)"
                  />
                  <YAxis stroke="rgba(100, 116, 139, 0.5)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="current" fill="#0ea5e9" name="Current value" />
                  <Bar dataKey="previous" fill="#cbd5e1" name="Previous value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="ra-trend-metrics">
            <strong>By marker (vs previous report)</strong>
            {trends.map(([name, t]) => {
              if (!t || typeof t !== "object") return null;
              const dir = (t as { trend_direction?: string }).trend_direction;
              const pct = (t as { average_percent_change?: number }).average_percent_change ?? 0;
              const currentVal = (t as { current_value?: number }).current_value;
              const barClass = dir === "increasing" ? "ra-trend-up" : dir === "decreasing" ? "ra-trend-down" : "ra-trend-flat";
              return (
                <div key={name} className={`ra-trend-row ${barClass}`}>
                  <span className="ra-trend-name">{name.replace(/_/g, " ")}</span>
                  <span className="ra-trend-value">{currentVal}</span>
                  <span className="ra-trend-dir">{dir}</span>
                  <span className="ra-trend-pct">{pct >= 0 ? "+" : ""}{pct}%</span>
                  <div className="ra-trend-bar" style={{ width: `${Math.min(100, Math.abs(pct) * 2)}%` }} aria-hidden />
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="ra-trend-empty">
          <p className="ra-muted">
            No trend data yet. Add another report above and analyze it, or click &quot;Analyze report trends&quot; to load trends for linked reports.
          </p>
        </div>
      )}
    </div>
  );
}

function Dropdown({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`ra-dropdown ${isOpen ? "open" : ""}`}>
      <button type="button" className="ra-dropdown-toggle" onClick={onToggle}>
        {title}
        <svg className="ra-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && <div className="ra-dropdown-body">{children}</div>}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "low" | "moderate" | "high" | "critical";
}) {
  const variantClass = variant ? `ra-risk-${variant}` : "";
  return (
    <div className={`ra-summary-card ${variantClass}`}>
      <div className="ra-summary-label">{label}</div>
      <div className="ra-summary-value">{value}</div>
    </div>
  );
}
