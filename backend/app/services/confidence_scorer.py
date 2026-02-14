"""
Analysis Confidence Scoring – OCR quality and data completeness.
"""

import re
from typing import Dict, List, Optional


def calculate_ocr_confidence(text: str, is_image_source: bool = False) -> Dict:
    if not is_image_source:
        return {"ocr_confidence": 0.95, "text_quality": "high", "issues": []}
    issues = []
    confidence = 1.0
    garbled_ratio = len(re.findall(r'[^a-zA-Z0-9\s\.\,\:\-\(\)]', text)) / max(len(text), 1)
    if garbled_ratio > 0.1:
        issues.append("High proportion of non-standard characters")
        confidence -= 0.2
    if len(text.strip()) < 50:
        issues.append("Extracted text is very short")
        confidence -= 0.15
    medical_terms = ["glucose", "hemoglobin", "cholesterol", "creatinine", "laboratory", "test", "result", "normal", "mg/dl", "reference"]
    found = sum(1 for t in medical_terms if t in text.lower())
    if found / len(medical_terms) > 0.3:
        confidence = min(1.0, confidence + 0.1)
    confidence = max(0.0, min(1.0, confidence))
    quality = "high" if confidence >= 0.8 else ("medium" if confidence >= 0.6 else "low")
    return {"ocr_confidence": round(confidence, 2), "text_quality": quality, "issues": issues}


def calculate_completeness_score(extracted_values: Dict, expected_tests: Optional[List[str]] = None) -> Dict:
    if not extracted_values:
        return {"completeness_score": 0.0, "tests_found": 0, "tests_expected": 0, "coverage_percent": 0.0, "missing_tests": []}
    expected = expected_tests or ["glucose", "hemoglobin", "hba1c", "cholesterol", "ldl", "hdl", "triglycerides", "creatinine"]
    found = set(extracted_values.keys())
    expected_set = set(expected)
    missing = list(expected_set - found)
    coverage = len(found & expected_set) / max(len(expected_set), 1)
    return {
        "completeness_score": round(min(1.0, coverage + min(0.2, len(found - expected_set) * 0.05)), 2),
        "tests_found": len(found),
        "tests_expected": len(expected_set),
        "coverage_percent": round(coverage * 100, 1),
        "missing_tests": missing,
    }


def calculate_value_plausibility_score(extracted_values: Dict) -> Dict:
    ranges = {"glucose": (20, 1000), "hba1c": (3, 20), "hemoglobin": (3, 25), "cholesterol": (50, 1000), "ldl": (0, 500), "hdl": (0, 200), "triglycerides": (0, 2000), "creatinine": (0.1, 20), "alt": (0, 2000), "ast": (0, 2000), "tsh": (0.01, 100), "vitamin_d": (0, 200)}
    implausible = []
    plausible = 0
    total = 0
    for name, val in extracted_values.items():
        for key, (lo, hi) in ranges.items():
            if key in name.lower():
                total += 1
                if lo <= val <= hi:
                    plausible += 1
                else:
                    implausible.append({"test": name, "value": val})
                break
        else:
            total += 1
            plausible += 1
    score = plausible / max(total, 1) if total else 1.0
    return {"plausibility_score": round(score, 2), "implausible_values": implausible}


def calculate_overall_confidence(
    text: str,
    extracted_values: Dict,
    is_image_source: bool = False,
    expected_tests: Optional[List[str]] = None,
) -> Dict:
    ocr = calculate_ocr_confidence(text, is_image_source)
    comp = calculate_completeness_score(extracted_values, expected_tests)
    plaus = calculate_value_plausibility_score(extracted_values)
    overall = ocr["ocr_confidence"] * 0.3 + comp["completeness_score"] * 0.4 + plaus["plausibility_score"] * 0.3
    level = "high" if overall >= 0.8 else ("medium" if overall >= 0.6 else ("low" if overall >= 0.4 else "very_low"))
    recs = []
    if overall < 0.6:
        recs.append("Consider manual review of extracted values.")
    if ocr["ocr_confidence"] < 0.7:
        recs.append("OCR quality may be low. Consider re-scanning.")
    if comp["completeness_score"] < 0.5:
        recs.append(f"Only {comp['tests_found']} test(s) found. Expected more.")
    if plaus["implausible_values"]:
        recs.append("Some values appear implausible. Verify against original report.")
    if not recs:
        recs.append("Analysis confidence is high. Results are reliable.")
    return {
        "overall_confidence": round(overall, 2),
        "confidence_level": level,
        "components": {"ocr_quality": ocr, "data_completeness": comp, "value_plausibility": plaus},
        "recommendations": recs,
    }
