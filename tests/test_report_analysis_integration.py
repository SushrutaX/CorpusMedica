from fastapi.testclient import TestClient
import app.main as app_module
from app import services


def fake_extract_text(file):
    # return sample text that our parser understands
    return "Hemoglobin: 11.2\nGlucose: 168\nHbA1c: 6.4\nCholesterol: 230"


def test_report_analysis(monkeypatch):
    # Patch OCR extraction to avoid heavy dependencies
    monkeypatch.setattr(services.report_text_extractor, "extract_text", fake_extract_text)
    # Disable auth for tests
    monkeypatch.setenv("AUTH_ENABLED", "false")

    client = TestClient(app_module.app)
    with open("sample_report.txt", "rb") as f:
        resp = client.post("/api/reports/analyze", files={"file": ("sample_report.txt", f, "text/plain")})

    assert resp.status_code == 200
    data = resp.json()
    assert "extracted_values" in data
    assert float(data["extracted_values"]["glucose"]) == 168.0
