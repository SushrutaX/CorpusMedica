import { useCallback, useMemo, useState } from "react";
import { LabMarkerIcon } from "../components/LabMarkerIcon";
import "./ReportAnalysis.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";
const AUTH_TOKEN_KEY = "medai_auth_token";

type ReportResponse = {
  report_id?: string;
  extracted_data?: {
    lab_values: Record<string, number>;
    demographics: { age_years?: number; sex?: string; fasting_status?: string };
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
  trend_analysis?: { summary?: { improving: number; worsening: number; stable: number }; trends?: Record<string, unknown> };
  imaging_correlation?: { correlations: Array<{ type: string; lab_finding: string; imaging_finding: string; significance: string }>; insights: string[] };
};

export default function ReportAnalysis() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [fasting, setFasting] = useState("");
  const [openSection, setOpenSection] = useState<string | null>("values");

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

  const analyze = useCallback(async () => {
    if (!file) {
      setError("Select a report file first.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (age.trim()) form.append("age_years", age.trim());
      if (sex.trim()) form.append("sex", sex.trim());
      if (fasting.trim()) form.append("fasting_status", fasting.trim());

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
      setResult(data as ReportResponse);
      setOpenSection("values");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report analysis failed.");
    } finally {
      setLoading(false);
    }
  }, [file, age, sex, fasting]);

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

  return (
    <div className="report-analysis-dark" id="report-analysis">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
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
          <input
            type="number"
            className="ra-input"
            placeholder="Age (optional)"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min={1}
            max={120}
          />
          <select
            className="ra-select"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
          >
            <option value="">Sex (optional)</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <select
            className="ra-select"
            value={fasting}
            onChange={(e) => setFasting(e.target.value)}
          >
            <option value="">Fasting (optional)</option>
            <option value="fasting">Fasting</option>
            <option value="non_fasting">Non-fasting</option>
          </select>
          <button
            type="button"
            className="ra-btn-analyze"
            onClick={analyze}
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
          <div style={{ marginTop: "2rem" }}>
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

            <Section title="Extracted values" open={isOpen("values")} onToggle={() => toggle("values")}>
              {labValues.length ? (
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
              ) : (
                <p className="ra-muted">No structured values detected.</p>
              )}
            </Section>

            <Section title="Risk summary & explanations" open={isOpen("risk")} onToggle={() => toggle("risk")}>
              {result.risk_analysis.explanations?.length ? (
                <ul>
                  {result.risk_analysis.explanations.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : null}
              {result.risk_analysis.possible_symptoms?.length ? (
                <p style={{ marginTop: "0.75rem" }}>
                  <strong>Possible symptoms:</strong> {result.risk_analysis.possible_symptoms.join(", ")}
                </p>
              ) : null}
              {result.risk_analysis.disclaimer && (
                <p className="ra-muted" style={{ marginTop: "1rem", fontSize: "0.9rem" }}>{result.risk_analysis.disclaimer}</p>
              )}
            </Section>

            {result.risk_analysis.prioritized_abnormalities?.length ? (
              <Section title="Prioritized abnormalities" open={isOpen("priority")} onToggle={() => toggle("priority")}>
                <ul>
                  {result.risk_analysis.prioritized_abnormalities.slice(0, 8).map((a, i) => (
                    <li key={i} style={{ marginBottom: "0.5rem" }}>
                      <strong>{a.test_name.replace(/_/g, " ").toUpperCase()}</strong> — {a.value} ({a.priority.urgency} priority, score {a.priority.priority_score.toFixed(1)})
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {result.risk_analysis.risk_clusters && result.risk_analysis.risk_clusters.cluster_count > 0 ? (
              <Section title="Risk clusters" open={isOpen("clusters")} onToggle={() => toggle("clusters")}>
                {result.risk_analysis.risk_clusters.detected_clusters.map((c, i) => (
                  <div key={i} className="ra-cluster-card">
                    <div className="ra-cluster-name">{c.pattern_name.replace(/_/g, " ")}</div>
                    <p className="ra-cluster-desc">{c.description}</p>
                    <span className="ra-cluster-severity">{c.severity}</span>
                  </div>
                ))}
              </Section>
            ) : null}

            {result.doctor_discussion_prompts ? (
              <Section title="Questions for your doctor" open={isOpen("doctor")} onToggle={() => toggle("doctor")}>
                {result.doctor_discussion_prompts.prompts.critical_questions?.length ? (
                  <div style={{ marginBottom: "1rem" }}>
                    <strong className="ra-critical">Critical</strong>
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
              </Section>
            ) : null}

            {result.procedure_risks ? (
              <Section title="Procedure risk assessment" open={isOpen("procedure")} onToggle={() => toggle("procedure")}>
                <p><strong>Overall:</strong> {result.procedure_risks.overall_procedure_risk}</p>
                {result.procedure_risks.flagged_risks?.length ? (
                  <ul>
                    {result.procedure_risks.flagged_risks.map((r, i) => (
                      <li key={i} style={{ marginBottom: "0.5rem" }}>{r.description} — {r.recommendation}</li>
                    ))}
                  </ul>
                ) : null}
                {result.procedure_risks.recommendations?.length ? (
                  <ul style={{ marginTop: "0.5rem" }}>
                    {result.procedure_risks.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                ) : null}
              </Section>
            ) : null}

            {result.trend_analysis?.summary ? (
              <Section title="Trend analysis" open={isOpen("trend")} onToggle={() => toggle("trend")}>
                <div className="ra-trend-pills">
                  <span className="ra-trend-pill ra-improving">Improving: {result.trend_analysis.summary.improving}</span>
                  <span className="ra-trend-pill ra-worsening">Worsening: {result.trend_analysis.summary.worsening}</span>
                  <span className="ra-trend-pill ra-stable">Stable: {result.trend_analysis.summary.stable}</span>
                </div>
              </Section>
            ) : null}

            {result.imaging_correlation?.correlations?.length ? (
              <Section title="Imaging correlation" open={isOpen("imaging")} onToggle={() => toggle("imaging")}>
                {result.imaging_correlation.correlations.map((c, i) => (
                  <div key={i} style={{ marginBottom: "0.75rem" }}>
                    <strong>{c.type}</strong>: {c.lab_finding} ↔ {c.imaging_finding}. {c.significance}
                  </div>
                ))}
                {result.imaging_correlation.insights?.length ? (
                  <ul style={{ marginTop: "0.5rem" }}>
                    {result.imaging_correlation.insights.map((ins, i) => (
                      <li key={i}>{ins}</li>
                    ))}
                  </ul>
                ) : null}
              </Section>
            ) : null}

            {result.digital_twin_inputs ? (
              <Section title="Digital twin export" open={isOpen("digital")} onToggle={() => toggle("digital")}>
                <p className="ra-muted" style={{ marginBottom: "0.5rem" }}>Data prepared for simulation models.</p>
                <button type="button" className="ra-btn-ghost" onClick={downloadDigitalTwin}>
                  Download JSON
                </button>
              </Section>
            ) : null}

            <Section title="AI explanation" open={isOpen("ai")} onToggle={() => toggle("ai")}>
              <p style={{ whiteSpace: "pre-wrap" }}>{result.llm_explanation}</p>
            </Section>

            {result.confidence_analysis ? (
              <Section title="Confidence & recommendations" open={isOpen("confidence")} onToggle={() => toggle("confidence")}>
                <p><strong>Level:</strong> {result.confidence_analysis.confidence_level} ({(result.confidence_analysis.overall_confidence * 100).toFixed(0)}%)</p>
                {result.confidence_analysis.recommendations?.length ? (
                  <ul style={{ marginTop: "0.5rem" }}>
                    {result.confidence_analysis.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                ) : null}
              </Section>
            ) : null}
          </div>
        )}
      </div>
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

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`ra-section ${open ? "open" : ""}`}>
      <button type="button" className="ra-section-toggle" onClick={onToggle}>
        {title}
        <svg className="ra-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="ra-section-body">{children}</div>}
    </div>
  );
}
