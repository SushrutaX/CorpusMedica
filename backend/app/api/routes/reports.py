from fastapi import APIRouter, UploadFile, File
from app.services.report_text_extractor import extract_text
from app.services.report_parser import parse_report
from app.services.risk_engine import analyze_risk
from app.services.groq_explainer import explain_report_with_groq

router = APIRouter()

@router.post("/reports/analyze")
async def analyze_report(file: UploadFile = File(...)):
    # 1. Extract text (OCR / PDF / TXT)
    text = await extract_text(file)

    # 2. Parse lab values
    extracted_values = parse_report(text)

    # 3. Rule-based risk analysis
    risk_analysis = analyze_risk(extracted_values)

    # 4. LLM explanation (Groq)
    explanation = explain_report_with_groq(
        extracted_values,
        risk_analysis
    )

    return {
        "extracted_values": extracted_values,
        "risk_analysis": risk_analysis,
        "llm_explanation": explanation
    }
