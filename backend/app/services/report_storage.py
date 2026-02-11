"""
Simple file-based storage for report history (trend analysis).

Reports are stored under backend/data/reports/*.json. For Docker, mount a volume
so this directory persists (e.g. -v ./data/reports:/app/data/reports); otherwise
reports are lost on container restart and trend analysis will not see previous reports.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from uuid import uuid4

STORAGE_DIR = Path(__file__).resolve().parents[2] / "data" / "reports"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

def save_report(report_data: Dict, patient_id: Optional[str] = None) -> str:
    rid = str(uuid4())
    report_data["report_id"] = rid
    report_data["timestamp"] = datetime.now().isoformat()
    # Top-level patient_id so get_patient_reports() can find this report for trend analysis
    report_data["patient_id"] = patient_id or report_data.get("extracted_data", {}).get("demographics", {}).get("patient_id") or rid
    p = STORAGE_DIR / f"{rid}.json"
    with open(p, "w") as f:
        json.dump(report_data, f, indent=2)
    return rid

def get_report(report_id: str) -> Optional[Dict]:
    p = STORAGE_DIR / f"{report_id}.json"
    if not p.exists():
        return None
    with open(p, "r") as f:
        return json.load(f)

def get_patient_reports(patient_id: str, limit: int = 10) -> List[Dict]:
    out = []
    for p in sorted(STORAGE_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            with open(p) as f:
                d = json.load(f)
                if d.get("patient_id") == patient_id:
                    out.append(d)
                    if len(out) >= limit:
                        break
        except (json.JSONDecodeError, OSError):
            continue
    return out

def get_all_reports(limit: int = 100) -> List[Dict]:
    out = []
    for p in sorted(STORAGE_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            with open(p) as f:
                out.append(json.load(f))
                if len(out) >= limit:
                    break
        except (json.JSONDecodeError, OSError):
            continue
    return out
