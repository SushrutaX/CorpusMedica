from fastapi import APIRouter, UploadFile, File, Form, Query
from typing import Optional as TypingOptional
from datetime import datetime

from app.services.report_text_extractor import extract_text
from app.services.report_parser import parse_report
from app.services.risk_engine import analyze_risk
from app.services.groq_explainer import explain_report_with_groq
from app.services.confidence_scorer import calculate_overall_confidence
from app.services.doctor_prompts import generate_discussion_prompts
from app.services.trend_analysis import analyze_all_trends
from app.services.imaging_correlation import correlate_lab_with_imaging
from app.services.procedure_risk import assess_procedure_risks
from app.services.digital_twin import prepare_digital_twin_inputs, export_fhir_format
from app.services.population_insights import anonymize_report, aggregate_population_data
from app.services.report_storage import save_report, get_patient_reports, get_all_reports

router = APIRouter()


@router.post("/reports/analyze")
async def analyze_report(
    file: UploadFile = File(...),
    age_years: TypingOptional[int] = Form(None),
    sex: TypingOptional[str] = Form(None),
    fasting_status: TypingOptional[str] = Form(None),
    expected_tests: TypingOptional[str] = Form(None),
    patient_id: TypingOptional[str] = Form(None),  # Link to previous report for trend (e.g. first report's report_id)
):
    text, is_image_source = await extract_text(file)
    parsed_data = parse_report(text)

    expected_list = [x.strip() for x in expected_tests.split(",")] if expected_tests else None
    confidence_analysis = calculate_overall_confidence(
        text,
        parsed_data.get("lab_values", {}),
        is_image_source=is_image_source,
        expected_tests=expected_list,
    )

    risk_analysis = analyze_risk(
        parsed_data,
        age_years=age_years,
        sex=sex,
        fasting_status=fasting_status,
    )

    explanation = explain_report_with_groq(
        parsed_data.get("lab_values", {}),
        risk_analysis,
    )

    discussion_prompts = generate_discussion_prompts(risk_analysis, confidence_analysis)
    procedure_risks = assess_procedure_risks(
        parsed_data.get("lab_values", {}),
        risk_analysis.get("interpretations", {}),
    )
    digital_twin_inputs = prepare_digital_twin_inputs(
        parsed_data.get("lab_values", {}),
        parsed_data.get("demographics", {}),
    )

    payload = {
        "extracted_data": parsed_data,
        "risk_analysis": risk_analysis,
        "confidence_analysis": confidence_analysis,
        "llm_explanation": explanation,
        "doctor_discussion_prompts": discussion_prompts,
        "procedure_risks": procedure_risks,
        "digital_twin_inputs": digital_twin_inputs,
        "imaging_correlation": correlate_lab_with_imaging(risk_analysis),
    }

    link_id = patient_id or parsed_data.get("demographics", {}).get("patient_id")
    report_id = save_report(
        {"extracted_data": parsed_data, "risk_analysis": risk_analysis, "confidence_analysis": confidence_analysis},
        patient_id=link_id,
    )
    payload["report_id"] = report_id
    payload["patient_id"] = link_id or report_id

    trend_analysis = None
    raw_hist = get_patient_reports(link_id or report_id, limit=10)
    if raw_hist:
        current = {"lab_values": parsed_data.get("lab_values", {}), "timestamp": datetime.now().isoformat()}
        historical = [
            {"lab_values": h.get("extracted_data", {}).get("lab_values", {}), "timestamp": h.get("timestamp")}
            for h in raw_hist[1:]
        ]
        if historical:
            trend_analysis = analyze_all_trends(current, historical)
    payload["trend_analysis"] = trend_analysis

    return payload


@router.get("/reports/trends/{patient_id}")
def get_trends(patient_id: str, limit: int = Query(10, ge=1, le=50)):
    hist = get_patient_reports(patient_id, limit=limit)
    if not hist:
        return {"message": "No historical reports found", "trends": {}}
    current, past = hist[0], hist[1:]
    if not past:
        return {"message": "Insufficient data for trend analysis", "trends": {}}
    return analyze_all_trends(current, past)


@router.get("/reports/population-insights")
def get_population_insights(limit: int = Query(100, ge=1, le=1000)):
    reports = get_all_reports(limit=limit)
    anonymized = [anonymize_report(r) for r in reports]
    return aggregate_population_data(anonymized)


@router.get("/reports/{report_id}/digital-twin")
def get_digital_twin_export(report_id: str, format: str = Query("json", regex="^(json|fhir)$")):
    from app.services.report_storage import get_report

    report = get_report(report_id)
    if not report:
        return {"error": "Report not found"}
    data = report.get("extracted_data", {})
    labs = data.get("lab_values", {})
    demo = data.get("demographics", {})
    if format == "fhir":
        return export_fhir_format(labs, demo)
    return prepare_digital_twin_inputs(labs, demo)
