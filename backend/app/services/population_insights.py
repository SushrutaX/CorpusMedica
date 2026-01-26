"""
Population-Level Insights – aggregate anonymized report data.
"""

from typing import Dict, List, Optional
from collections import defaultdict
import statistics

def _age_group(age: Optional[int]) -> Optional[str]:
    if age is None:
        return None
    if age < 18:
        return "pediatric"
    for lo, hi, label in [(18, 29, "18-29"), (30, 39, "30-39"), (40, 49, "40-49"), (50, 59, "50-59"), (60, 69, "60-69")]:
        if lo <= age <= hi:
            return label
    return "70+"

def anonymize_report(report: Dict) -> Dict:
    demo = report.get("demographics", {})
    risk = report.get("risk_analysis", {})
    return {"age_group": _age_group(demo.get("age_years")), "sex": demo.get("sex"), "lab_values": report.get("lab_values", {}), "risk_level": risk.get("risk_level"), "abnormality_count": len(risk.get("abnormalities", {}))}

def aggregate_population_data(reports: List[Dict]) -> Dict:
    if not reports:
        return {"total_reports": 0, "message": "No data for aggregation"}
    age_groups = defaultdict(int)
    sex_dist = defaultdict(int)
    risk_dist = defaultdict(int)
    lab_agg = defaultdict(list)
    abn_counts = []
    for r in reports:
        ag = r.get("age_group")
        if ag:
            age_groups[ag] += 1
        sx = r.get("sex")
        if sx:
            sex_dist[sx] += 1
        rl = r.get("risk_level")
        if rl:
            risk_dist[rl] += 1
        abn_counts.append(r.get("abnormality_count", 0))
        for k, v in r.get("lab_values", {}).items():
            lab_agg[k].append(v)
    lab_stats = {}
    for k, vals in lab_agg.items():
        if vals:
            lab_stats[k] = {"count": len(vals), "mean": round(statistics.mean(vals), 2), "median": round(statistics.median(vals), 2), "min": round(min(vals), 2), "max": round(max(vals), 2)}
    insights = []
    n = len(reports)
    if n >= 10 and "glucose" in lab_stats and lab_stats["glucose"]["mean"] > 100:
        insights.append("Population average glucose elevated. Possible high diabetes prevalence.")
    if risk_dist.get("high", 0) / max(n, 1) > 0.2:
        insights.append("Over 20% high-risk reports. Consider enhanced screening.")
    return {"total_reports": n, "demographics": {"age_groups": dict(age_groups), "sex_distribution": dict(sex_dist)}, "risk_distribution": dict(risk_dist), "lab_statistics": lab_stats, "abnormality_average": round(statistics.mean(abn_counts), 2) if abn_counts else 0, "insights": insights}
