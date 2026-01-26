"""
Trend Analysis Over Time – compare current vs past reports.
"""

from typing import Dict, List, Optional
from datetime import datetime

def calculate_trend(current: float, previous: float, days_between: int) -> Dict:
    if days_between <= 0:
        days_between = 1
    change = current - previous
    pct = (change / previous * 100) if previous != 0 else 0
    direction = "stable" if abs(pct) < 5 else ("increasing" if pct > 0 else "decreasing")
    return {"direction": direction, "absolute_change": round(change, 2), "percent_change": round(pct, 1), "days_between": days_between}


def analyze_all_trends(current_report: Dict, historical_reports: List[Dict]) -> Dict:
    lab_values = current_report.get("lab_values", {})
    trends = {}
    improving = worsening = stable = 0
    for name in lab_values:
        current_val = lab_values[name]
        current_ts = current_report.get("timestamp") or datetime.now()
        if isinstance(current_ts, str):
            current_ts = datetime.fromisoformat(current_ts.replace("Z", "+00:00"))
        hist = []
        for h in historical_reports:
            hv = h.get("lab_values", {}).get(name)
            if hv is None:
                continue
            ht = h.get("timestamp") or current_ts
            if isinstance(ht, str):
                ht = datetime.fromisoformat(ht.replace("Z", "+00:00"))
            days = (current_ts - ht).days
            if days <= 0:
                continue
            t = calculate_trend(current_val, hv, days)
            t["previous_value"] = hv
            hist.append(t)
        if not hist:
            continue
        dirs = [x["direction"] for x in hist]
        main_dir = max(set(dirs), key=dirs.count)
        avg_pct = sum(x["percent_change"] for x in hist) / len(hist)
        trends[name] = {"test_name": name, "current_value": current_val, "trend_direction": main_dir, "average_percent_change": round(avg_pct, 1), "data_points": len(hist), "trends": hist}
        if main_dir == "stable":
            stable += 1
        elif main_dir == "increasing" and name.lower() in ["glucose", "hba1c", "cholesterol", "ldl", "creatinine"]:
            worsening += 1
        elif main_dir == "decreasing" and name.lower() in ["hemoglobin", "hdl"]:
            worsening += 1
        elif main_dir == "decreasing" and name.lower() in ["glucose", "hba1c", "cholesterol", "ldl", "creatinine"]:
            improving += 1
        elif main_dir == "increasing" and name.lower() in ["hemoglobin", "hdl"]:
            improving += 1
        else:
            stable += 1
    return {"trends": trends, "summary": {"improving": improving, "worsening": worsening, "stable": stable, "total_tests_with_trends": len(trends)}}
