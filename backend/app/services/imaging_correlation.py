"""
Report ↔ Imaging Correlation – link lab findings with imaging results.
"""

from typing import Dict, List, Optional

def correlate_lab_with_imaging(lab_findings: Dict, imaging_results: Optional[Dict] = None) -> Dict:
    if not imaging_results:
        return {"correlations": [], "insights": ["No imaging data available for correlation."], "has_imaging": False}
    abns = lab_findings.get("abnormalities", {})
    clusters = lab_findings.get("risk_clusters", {}).get("detected_clusters", [])
    correlations = []
    insights = []
    if "creatinine" in abns and imaging_results.get("organ") == "kidney":
        correlations.append({"type": "kidney_dysfunction", "lab_finding": "Elevated creatinine", "imaging_finding": imaging_results.get("findings", "Kidney imaging"), "significance": "Lab and imaging suggest kidney involvement."})
        insights.append("Elevated creatinine correlates with kidney imaging. Consider renal evaluation.")
    if any(t in abns for t in ["alt", "ast"]) and imaging_results.get("organ") == "liver":
        correlations.append({"type": "liver_dysfunction", "lab_finding": "Elevated liver enzymes", "imaging_finding": imaging_results.get("findings", "Liver imaging"), "significance": "Lab and imaging suggest liver involvement."})
    if any(c["pattern_name"] == "cardiovascular_risk" for c in clusters) and imaging_results.get("modality") == "CT":
        correlations.append({"type": "cardiovascular", "lab_finding": "Elevated cardiovascular risk", "imaging_finding": imaging_results.get("findings", "Cardiac imaging"), "significance": "Lab and imaging may indicate cardiovascular disease."})
    return {"correlations": correlations, "insights": insights or ["No significant correlations detected."], "has_imaging": True}
