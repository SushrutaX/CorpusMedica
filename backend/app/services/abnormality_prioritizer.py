"""
Abnormality Prioritization – rank abnormal lab values by clinical importance.
"""

from typing import Dict, List, Optional
from app.services.reference_ranges import Sex, FastingStatus

IMPORTANCE = {
    "glucose": {"high": (90, 400), "low": (95, 50)},
    "creatinine": {"high": (88, 5.0), "low": (20, 0.3)},
    "hemoglobin": {"low": (75, 7.0), "high": (40, 20.0)},
    "hba1c": {"high": (85, 10.0), "low": (30, 3.0)},
    "cholesterol": {"high": (70, 300), "low": (15, 100)},
    "ldl": {"high": (75, 190), "low": (10, 40)},
    "hdl": {"low": (65, 30), "high": (5, 100)},
    "triglycerides": {"high": (60, 500), "low": (10, 50)},
    "alt": {"high": (55, 200), "low": (5, 5)},
    "ast": {"high": (55, 200), "low": (5, 5)},
    "tsh": {"high": (50, 10.0), "low": (50, 0.1)},
    "vitamin_d": {"low": (35, 10.0), "high": (20, 100)},
}

def calculate_priority_score(test_name: str, value: float, is_high: bool, deviation_percent: float, _interp: Dict) -> Dict:
    test_lower = test_name.lower()
    config = None
    for k, v in IMPORTANCE.items():
        if k in test_lower:
            config = v
            break
    if not config:
        base, mult = 40, 1.0
    else:
        direction = "high" if is_high else "low"
        if direction not in config:
            base, mult = 30, 1.0
        else:
            base, thresh = config[direction]
            mult = 1.5 if (is_high and value >= thresh) or (not is_high and value <= thresh) else 1.0 + (deviation_percent / 100) * 0.5
    score = min(100.0, base * mult)
    urgency = "critical" if score >= 85 else ("high" if score >= 60 else ("moderate" if score >= 40 else "low"))
    return {"priority_score": round(score, 1), "urgency": urgency, "deviation_percent": deviation_percent}


def prioritize_abnormalities(interpretations: Dict, age_years: Optional[int] = None, sex: Optional[Sex] = None, fasting: Optional[FastingStatus] = None) -> List[Dict]:
    out = []
    for name, interp in interpretations.items():
        if interp.get("is_normal", True):
            continue
        is_high = interp.get("is_high", False)
        val = interp.get("value", 0)
        dev = interp.get("deviation_percent", 0)
        prio = calculate_priority_score(name, val, is_high, dev, interp)
        out.append({"test_name": name, "value": val, "status": "high" if is_high else "low", "interpretation": interp, "priority": prio})
    out.sort(key=lambda x: x["priority"]["priority_score"], reverse=True)
    return out


def get_prioritized_summary(prioritized: List[Dict]) -> Dict:
    counts = {"critical": 0, "high": 0, "moderate": 0, "low": 0}
    for p in prioritized:
        u = p["priority"]["urgency"]
        counts[u] = counts.get(u, 0) + 1
    top = prioritized[:3]
    return {
        "total_abnormalities": len(prioritized),
        "urgency_breakdown": counts,
        "top_priorities": [{"test": x["test_name"], "value": x["value"], "priority_score": x["priority"]["priority_score"], "urgency": x["priority"]["urgency"]} for x in top],
    }
