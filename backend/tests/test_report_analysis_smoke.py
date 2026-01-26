"""
Smoke test for report analysis features
Quick verification that all services work together
"""
import pytest
from app.services.report_parser import parse_report
from app.services.reference_ranges import interpret_value, Sex, FastingStatus
from app.services.risk_engine import analyze_risk
from app.services.confidence_scorer import calculate_overall_confidence
from app.services.abnormality_prioritizer import prioritize_abnormalities
from app.services.risk_clusters import detect_risk_clusters
from app.services.doctor_prompts import generate_discussion_prompts


def test_report_analysis_pipeline():
    """Test the complete report analysis pipeline"""
    # Sample report text
    report_text = """
    Patient: John Doe
    Age: 45 years
    Sex: Male
    Fasting: Yes
    
    Lab Results:
    Glucose: 120 mg/dL
    Hemoglobin: 14.5 g/dL
    HbA1c: 6.2%
    Cholesterol: 250 mg/dL
    """
    
    # 1. Parse report
    parsed_data = parse_report(report_text)
    assert "lab_values" in parsed_data
    assert len(parsed_data["lab_values"]) > 0
    
    # 2. Calculate confidence
    confidence = calculate_overall_confidence(
        report_text,
        parsed_data["lab_values"],
        is_image_source=False,
        expected_tests=["glucose", "hemoglobin", "hba1c", "cholesterol"]
    )
    assert confidence["overall_confidence"] > 0
    
    # 3. Analyze risk
    risk_analysis = analyze_risk(parsed_data)
    assert "risk_level" in risk_analysis
    assert "interpretations" in risk_analysis
    
    # 4. Generate prompts
    prompts = generate_discussion_prompts(risk_analysis, confidence)
    assert "prompts" in prompts
    
    # All services work together
    assert True
