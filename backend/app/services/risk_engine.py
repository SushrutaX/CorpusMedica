def analyze_risk(values):
    abnormalities = {}
    explanations = []
    symptoms = []

    if "hba1c" in values:
        if values["hba1c"] >= 6.5:
            abnormalities["hba1c"] = "Diabetes range"
            explanations.append("HbA1c indicates poor long-term glucose control.")
            symptoms += ["Fatigue", "Frequent urination", "Increased thirst"]

    if "glucose" in values:
        if values["glucose"] > 140:
            abnormalities["glucose"] = "Elevated blood glucose"
            explanations.append("Blood glucose is above normal limits.")

    if "hemoglobin" in values:
        if values["hemoglobin"] < 12:
            abnormalities["hemoglobin"] = "Low hemoglobin (possible anemia)"
            symptoms += ["Weakness", "Dizziness", "Shortness of breath"]

    if not abnormalities:
        level = "low"
    elif len(abnormalities) <= 2:
        level = "moderate"
    else:
        level = "high"

    return {
        "risk_level": level,
        "abnormalities": abnormalities,
        "explanations": explanations,
        "possible_symptoms": list(set(symptoms)),
        "disclaimer": "This is decision support, not a medical diagnosis."
    }
