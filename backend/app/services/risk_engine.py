from typing import Dict, Optional
from app.services.reference_ranges import interpret_value, Sex, FastingStatus
from app.services.abnormality_prioritizer import prioritize_abnormalities, get_prioritized_summary
from app.services.risk_clusters import detect_risk_clusters


def analyze_risk(parsed_data: Dict, age_years: Optional[int] = None, sex: Optional[str] = None, fasting_status: Optional[str] = None):
    lab_values = parsed_data.get("lab_values", {})
    demographics = parsed_data.get("demographics", {})
    age = age_years or demographics.get("age_years")
    sex_enum = None
    if sex:
        sex_enum = Sex(sex.lower()) if sex.lower() in ("male", "female") else None
    elif demographics.get("sex"):
        try:
            sex_enum = Sex(demographics["sex"])
        except ValueError:
            pass
    fasting_enum = None
    if fasting_status:
        fasting_enum = FastingStatus(fasting_status.lower()) if fasting_status.lower() in ("fasting", "non_fasting") else None
    elif demographics.get("fasting_status"):
        try:
            fasting_enum = FastingStatus(demographics["fasting_status"])
        except ValueError:
            pass

    abnormalities = {}
    interpretations = {}
    explanations = []
    symptoms = []

    for name, val in lab_values.items():
        interp = interpret_value(name, val, age, sex_enum, fasting_enum)
        interpretations[name] = interp
        if not interp["is_normal"]:
            abnormalities[name] = {
                "value": val,
                "status": "low" if interp["is_low"] else "high",
                "deviation_percent": interp["deviation_percent"],
                "reference_range": interp["reference_range"],
                "interpretation": interp["interpretation"],
            }
            explanations.append(f"{name.upper()}: {interp['interpretation']}")

    if "hba1c" in abnormalities or "glucose" in abnormalities:
        symptoms += ["Fatigue", "Frequent urination", "Increased thirst"]
    if "hemoglobin" in abnormalities:
        symptoms += ["Weakness", "Dizziness", "Shortness of breath"]
    if "cholesterol" in abnormalities or "ldl" in abnormalities:
        symptoms += ["Chest discomfort", "Shortness of breath"]
    if "creatinine" in abnormalities:
        symptoms += ["Fatigue", "Swelling", "Changes in urination"]

    prioritized = prioritize_abnormalities(interpretations, age, sex_enum, fasting_enum)
    priority_summary = get_prioritized_summary(prioritized)
    risk_clusters = detect_risk_clusters(interpretations, age, demographics.get("sex"))

    if not abnormalities:
        level = "low"
    elif prioritized and prioritized[0]["priority"]["urgency"] == "critical":
        level = "critical"
    elif risk_clusters.get("overall_cluster_risk") == "critical":
        level = "critical"
    elif prioritized and prioritized[0]["priority"]["urgency"] == "high":
        level = "high"
    elif risk_clusters.get("overall_cluster_risk") == "high":
        level = "high"
    elif len(abnormalities) <= 2:
        level = "moderate"
    else:
        level = "high"

    return {
        "risk_level": level,
        "abnormalities": abnormalities,
        "prioritized_abnormalities": prioritized,
        "priority_summary": priority_summary,
        "risk_clusters": risk_clusters,
        "interpretations": interpretations,
        "explanations": explanations,
        "possible_symptoms": list(set(symptoms)),
        "personalized_context": {"age_years": age, "sex": sex_enum.value if sex_enum else None, "fasting_status": fasting_enum.value if fasting_enum else None},
        "disclaimer": "This is decision support, not a medical diagnosis. Reference ranges are personalized when age/sex/fasting available.",
    }
