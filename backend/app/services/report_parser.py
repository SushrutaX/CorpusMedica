import re
from typing import Dict, Optional
from app.services.reference_ranges import Sex, FastingStatus

MARKERS = {
    "hemoglobin": r"(hemoglobin|hb|hgb)\s*[:\-]?\s*(\d+\.?\d*)",
    "glucose": r"(glucose|blood sugar|blood glucose)\s*[:\-]?\s*(\d+\.?\d*)",
    "hba1c": r"(hba1c|hemoglobin a1c|glycated hemoglobin)\s*[:\-]?\s*(\d+\.?\d*)",
    "cholesterol": r"(total cholesterol|cholesterol|tc)\s*[:\-]?\s*(\d+\.?\d*)",
    "ldl": r"(ldl|ldl cholesterol|low-density lipoprotein)\s*[:\-]?\s*(\d+\.?\d*)",
    "hdl": r"(hdl|hdl cholesterol|high-density lipoprotein)\s*[:\-]?\s*(\d+\.?\d*)",
    "triglycerides": r"(triglycerides|tg|trig)\s*[:\-]?\s*(\d+\.?\d*)",
    "creatinine": r"(creatinine|creat|scr)\s*[:\-]?\s*(\d+\.?\d*)",
    "alt": r"(alt|alanine aminotransferase|sgpt)\s*[:\-]?\s*(\d+\.?\d*)",
    "ast": r"(ast|aspartate aminotransferase|sgot)\s*[:\-]?\s*(\d+\.?\d*)",
    "tsh": r"(tsh|thyroid stimulating hormone)\s*[:\-]?\s*(\d+\.?\d*)",
    "vitamin_d": r"(vitamin d|25-oh vitamin d|25-hydroxyvitamin d)\s*[:\-]?\s*(\d+\.?\d*)",
}

AGE_PATTERNS = [r"age\s*[:\-]?\s*(\d+)", r"(\d+)\s*years?\s*old", r"(\d+)\s*yo\b", r"dob[:\-]?\s*\d{1,2}[/-]\d{1,2}[/-](\d{4})"]
SEX_PATTERNS = [r"\b(male|m)\b", r"\b(female|f)\b", r"sex[:\-]?\s*(male|female|m|f)", r"gender[:\-]?\s*(male|female|m|f)"]
FASTING_PATTERNS = [r"\b(fasting|fasted)\b", r"\b(non[- ]?fasting|nonfasting|postprandial)\b"]


def extract_age(text: str) -> Optional[int]:
    from datetime import datetime
    t = text.lower()
    for i, pat in enumerate(AGE_PATTERNS):
        m = re.search(pat, t)
        if m:
            s = m.group(1)
            try:
                if i == len(AGE_PATTERNS) - 1:
                    y = int(s)
                    age = datetime.now().year - y
                    return age if 0 <= age <= 150 else None
                age = int(s)
                return age if 0 <= age <= 150 else None
            except ValueError:
                continue
    return None


def extract_sex(text: str) -> Optional[Sex]:
    t = text.lower()
    for pat in SEX_PATTERNS:
        m = re.search(pat, t)
        if m:
            v = (m.group(1) if m.groups() else m.group(0)).lower()
            if "female" in v or v == "f" or "woman" in v:
                return Sex.FEMALE
            if "male" in v or v == "m" or "man" in v:
                return Sex.MALE
    return None


def extract_fasting(text: str) -> Optional[FastingStatus]:
    t = text.lower()
    if re.search(r"non[- ]?fasting|nonfasting|postprandial", t):
        return FastingStatus.NON_FASTING
    if re.search(r"fasting|fasted", t):
        return FastingStatus.FASTING
    return None


def parse_report(text: str) -> Dict:
    out = {"lab_values": {}, "demographics": {"age_years": None, "sex": None, "fasting_status": None}}
    t = text.lower()
    for key, pat in MARKERS.items():
        m = re.search(pat, t)
        if m:
            try:
                out["lab_values"][key] = float(m.group(2))
            except (ValueError, IndexError):
                pass
    out["demographics"]["age_years"] = extract_age(text)
    sx = extract_sex(text)
    if sx:
        out["demographics"]["sex"] = sx.value
    fs = extract_fasting(text)
    if fs:
        out["demographics"]["fasting_status"] = fs.value
    return out
