"""
Digital Twin Inputs – prepare lab values for simulation models.
"""

from typing import Dict, Optional
from datetime import datetime

CODE_MAP = {"glucose": "GLUC", "hba1c": "HBA1C", "hemoglobin": "HGB", "cholesterol": "CHOL", "ldl": "LDL", "hdl": "HDL", "triglycerides": "TRIG", "creatinine": "CREAT", "alt": "ALT", "ast": "AST", "tsh": "TSH", "vitamin_d": "VITD"}
UNIT_MAP = {"glucose": "mg/dL", "hba1c": "%", "hemoglobin": "g/dL", "cholesterol": "mg/dL", "ldl": "mg/dL", "hdl": "mg/dL", "triglycerides": "mg/dL", "creatinine": "mg/dL", "alt": "U/L", "ast": "U/L", "tsh": "mIU/L", "vitamin_d": "ng/mL"}

def _code(name: str) -> str:
    n = name.lower()
    for k, c in CODE_MAP.items():
        if k in n:
            return c
    return name.upper()[:4]

def _unit(name: str) -> str:
    n = name.lower()
    for k, u in UNIT_MAP.items():
        if k in n:
            return u
    return "unknown"

def prepare_digital_twin_inputs(lab_values: Dict, demographics: Dict, timestamp: Optional[str] = None) -> Dict:
    ts = timestamp or datetime.now().isoformat()
    normalized = {_code(k): {"value": v, "unit": _unit(k), "original_name": k} for k, v in lab_values.items()}
    return {"patient_id": demographics.get("patient_id", "anonymous"), "timestamp": ts, "demographics": {"age_years": demographics.get("age_years"), "sex": demographics.get("sex")}, "lab_values": normalized, "format_version": "1.0", "format_type": "digital_twin_input"}


def export_fhir_format(lab_values: Dict, demographics: Dict) -> Dict:
    """Minimal FHIR-like Bundle of Observations."""
    entries = []
    for name, val in lab_values.items():
        entries.append({
            "resourceType": "Observation",
            "status": "final",
            "code": {"coding": [{"code": _code(name), "display": name}]},
            "valueQuantity": {"value": val, "unit": _unit(name)},
            "effectiveDateTime": datetime.now().isoformat(),
        })
    return {"resourceType": "Bundle", "type": "collection", "entry": [{"resource": e} for e in entries]}
