"""
Procedure & Surgical Risk Flags – procedural/anesthesia risks from lab data.
"""

from typing import Dict, List, Optional

FACTORS = {
    "kidney_risk": {"tests": ["creatinine"], "threshold": 1.5, "level": "high", "desc": "Elevated creatinine – kidney dysfunction risk", "concern": "May affect drug clearance."},
    "bleeding_risk": {"tests": ["hemoglobin"], "threshold": 10.0, "level": "moderate", "desc": "Low hemoglobin – bleeding risk", "concern": "May require blood products."},
    "cardiac_risk": {"tests": ["cholesterol", "ldl"], "threshold": {"cholesterol": 240, "ldl": 160}, "level": "moderate", "desc": "Elevated cardiac markers", "concern": "Cardiac clearance and monitoring."},
    "diabetes_risk": {"tests": ["glucose", "hba1c"], "threshold": {"glucose": 200, "hba1c": 7.0}, "level": "moderate", "desc": "Poorly controlled diabetes", "concern": "Glucose monitoring."},
    "liver_risk": {"tests": ["alt", "ast"], "threshold": 100, "level": "moderate", "desc": "Elevated liver enzymes", "concern": "Drug metabolism."},
}

def assess_procedure_risks(lab_values: Dict, interpretations: Dict, procedure_type: Optional[str] = None) -> Dict:
    flagged = []
    for risk_name, cfg in FACTORS.items():
        for t in cfg["tests"]:
            if t not in lab_values:
                continue
            v = lab_values[t]
            interp = interpretations.get(t, {})
            th = cfg["threshold"]
            is_risky = False
            if isinstance(th, dict):
                if t in th and (interp.get("is_high") and v >= th[t] or interp.get("is_low") and v <= th[t]):
                    is_risky = True
            else:
                if interp.get("is_high") and v >= th or interp.get("is_low") and v <= th:
                    is_risky = True
            if is_risky:
                flagged.append({"risk_type": risk_name, "test_name": t, "value": v, "risk_level": cfg["level"], "description": cfg["desc"], "recommendation": "Discuss with anesthesiologist and surgical team."})
                break
    high = [f for f in flagged if f["risk_level"] == "high"]
    mod = [f for f in flagged if f["risk_level"] == "moderate"]
    overall = "high" if high else ("moderate" if mod else "low")
    recs = ["No significant procedure-related risks from lab values."] if not flagged else []
    if high:
        recs.append("HIGH RISK: Consider delaying procedure or specialist clearance.")
    recs.append("Review flagged risks with anesthesiologist and surgical team.")
    return {"overall_procedure_risk": overall, "flagged_risks": flagged, "risk_count": len(flagged), "recommendations": recs}
