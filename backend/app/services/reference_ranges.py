"""
Personalized Reference Ranges Service
Age, sex, and fasting-aware reference ranges for lab values.
"""

from typing import Dict, Optional, Tuple
from enum import Enum


class Sex(str, Enum):
    MALE = "male"
    FEMALE = "female"
    UNKNOWN = "unknown"


class FastingStatus(str, Enum):
    FASTING = "fasting"
    NON_FASTING = "non_fasting"
    UNKNOWN = "unknown"


def get_reference_range(
    test_name: str,
    age_years: Optional[int] = None,
    sex: Optional[Sex] = None,
    fasting: Optional[FastingStatus] = None,
) -> Tuple[float, float]:
    test_name_lower = test_name.lower()

    if test_name_lower in ["glucose", "blood glucose", "blood sugar"]:
        if fasting == FastingStatus.FASTING:
            return (70.0, 100.0)
        elif fasting == FastingStatus.NON_FASTING:
            return (70.0, 140.0)
        return (70.0, 140.0)

    if test_name_lower in ["hba1c", "hemoglobin a1c", "glycated hemoglobin"]:
        if age_years and age_years >= 65:
            return (4.0, 7.0)
        return (4.0, 5.7)

    if test_name_lower in ["hemoglobin", "hb", "hgb"]:
        if sex == Sex.MALE:
            if age_years and age_years < 18:
                if age_years < 1:
                    return (10.0, 15.0)
                elif age_years <= 5:
                    return (11.0, 14.0)
                elif age_years < 12:
                    return (11.5, 15.5)
                else:
                    return (12.0, 16.0)
            return (13.5, 17.5)
        elif sex == Sex.FEMALE:
            if age_years and age_years < 18:
                if age_years < 1:
                    return (10.0, 15.0)
                elif age_years <= 5:
                    return (11.0, 14.0)
                elif age_years < 12:
                    return (11.5, 15.5)
                else:
                    return (12.0, 15.0)
            return (12.0, 15.5)
        return (12.0, 17.5)

    if test_name_lower in ["cholesterol", "total cholesterol", "tc"]:
        if age_years and age_years < 20:
            return (120.0, 200.0)
        return (125.0, 200.0)

    if test_name_lower in ["ldl", "ldl cholesterol", "low-density lipoprotein"]:
        return (0.0, 100.0)

    if test_name_lower in ["hdl", "hdl cholesterol", "high-density lipoprotein"]:
        if sex == Sex.MALE:
            return (40.0, 100.0)
        elif sex == Sex.FEMALE:
            return (50.0, 100.0)
        return (40.0, 100.0)

    if test_name_lower in ["triglycerides", "tg", "trig"]:
        if fasting == FastingStatus.FASTING:
            return (0.0, 150.0)
        elif fasting == FastingStatus.NON_FASTING:
            return (0.0, 200.0)
        return (0.0, 200.0)

    if test_name_lower in ["creatinine", "creat", "scr"]:
        if sex == Sex.MALE:
            return (0.7, 1.3) if not (age_years and age_years < 18) else (0.3, 0.9)
        elif sex == Sex.FEMALE:
            return (0.6, 1.1) if not (age_years and age_years < 18) else (0.3, 0.7)
        return (0.6, 1.3)

    if test_name_lower in ["alt", "alanine aminotransferase", "sgpt"]:
        return (7.0, 56.0) if sex != Sex.FEMALE else (7.0, 40.0)

    if test_name_lower in ["ast", "aspartate aminotransferase", "sgot"]:
        return (10.0, 40.0)

    if test_name_lower in ["tsh", "thyroid stimulating hormone"]:
        return (0.4, 4.0) if not (age_years and age_years < 18) else (0.7, 6.4)

    if test_name_lower in ["vitamin_d", "vitamin d", "25-oh vitamin d", "25-hydroxyvitamin d"]:
        return (20.0, 50.0) if not (age_years and age_years < 18) else (20.0, 100.0)

    return (0.0, 999.0)


def interpret_value(
    test_name: str,
    value: float,
    age_years: Optional[int] = None,
    sex: Optional[Sex] = None,
    fasting: Optional[FastingStatus] = None,
) -> Dict:
    lower, upper = get_reference_range(test_name, age_years, sex, fasting)
    is_normal = lower <= value <= upper
    is_low = value < lower
    is_high = value > upper
    deviation_percent = ((lower - value) / lower * 100) if is_low else (((value - upper) / upper * 100) if is_high else 0.0)
    interpretation = "Within normal range" if is_normal else (f"Below normal (reference: {lower:.1f}-{upper:.1f})" if is_low else f"Above normal (reference: {lower:.1f}-{upper:.1f})")
    return {
        "value": value,
        "reference_range": {"lower": lower, "upper": upper},
        "is_normal": is_normal,
        "is_low": is_low,
        "is_high": is_high,
        "deviation_percent": round(deviation_percent, 1),
        "interpretation": interpretation,
        "personalized": {"age_years": age_years, "sex": sex.value if sex else None, "fasting_status": fasting.value if fasting else None},
    }
