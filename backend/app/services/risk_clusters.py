"""
Pattern-Based Risk Clusters – detect meaningful lab abnormality combinations.
"""

from typing import Dict, List, Optional

PATTERNS = {
    "metabolic_syndrome": {"required": ["glucose", "triglycerides", "hdl"], "severity": "high", "desc": "Metabolic syndrome – increased CVD/diabetes risk"},
    "diabetes_risk": {"required": ["glucose", "hba1c"], "severity": "high", "desc": "Elevated diabetes risk"},
    "cardiovascular_risk": {"required": ["cholesterol", "ldl", "hdl"], "severity": "high", "desc": "Elevated cardiovascular risk"},
    "kidney_dysfunction": {"required": ["creatinine"], "severity": "critical", "desc": "Possible kidney dysfunction"},
    "anemia": {"required": ["hemoglobin"], "severity": "moderate", "desc": "Possible anemia"},
    "liver_dysfunction": {"required": ["alt", "ast"], "severity": "moderate", "desc": "Possible liver dysfunction"},
    "severe_hyperglycemia": {"required": ["glucose"], "severity": "critical", "desc": "Severe hyperglycemia – potential emergency"},
    "severe_anemia": {"required": ["hemoglobin"], "severity": "critical", "desc": "Severe anemia"},
    "vitamin_d_deficiency": {"required": ["vitamin_d"], "severity": "moderate", "desc": "Vitamin D deficiency"},
}

def check_pattern(name: str, config: Dict, interpretations: Dict, sex: Optional[str] = None) -> Optional[Dict]:
    req = config["required"]
    if any(t not in interpretations for t in req):
        return None
    matched = []
    for t in req:
        interp = interpretations[t]
        if not interp.get("is_normal", True):
            matched.append(t)
    if len(matched) < len(req):
        return None
    return {"pattern_name": name, "description": config["desc"], "severity": config["severity"], "matched_tests": matched, "confidence": "high"}


def detect_risk_clusters(interpretations: Dict, age_years: Optional[int] = None, sex: Optional[str] = None) -> Dict:
    detected = []
    for name, config in PATTERNS.items():
        m = check_pattern(name, config, interpretations, sex)
        if m:
            detected.append(m)
    order = {"critical": 3, "high": 2, "moderate": 1, "low": 0}
    detected.sort(key=lambda x: order.get(x["severity"], 0), reverse=True)
    overall = "critical" if any(d["severity"] == "critical" for d in detected) else ("high" if any(d["severity"] == "high" for d in detected) else ("moderate" if detected else "low"))
    return {
        "detected_clusters": detected,
        "cluster_count": len(detected),
        "overall_cluster_risk": overall,
        "by_severity": {"critical": [d for d in detected if d["severity"] == "critical"], "high": [d for d in detected if d["severity"] == "high"], "moderate": [d for d in detected if d["severity"] == "moderate"]},
    }
