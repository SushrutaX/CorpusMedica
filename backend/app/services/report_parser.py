import re

MARKERS = {
    "hemoglobin": r"(hemoglobin|hb)\s*[:\-]?\s*(\d+\.?\d*)",
    "glucose": r"(glucose|blood sugar)\s*[:\-]?\s*(\d+\.?\d*)",
    "hba1c": r"(hba1c)\s*[:\-]?\s*(\d+\.?\d*)",
    "cholesterol": r"(cholesterol)\s*[:\-]?\s*(\d+\.?\d*)",
}

def parse_report(text: str):
    results = {}
    text = text.lower()

    for key, pattern in MARKERS.items():
        match = re.search(pattern, text)
        if match:
            results[key] = float(match.group(2))

    return results
