# Report Analysis

The report analysis module extracts structured findings from clinical text and PDFs.

## Pipeline components
- `report_text_extractor.py`: loads PDFs and extracts raw text
- `report_parser.py`: normalizes and structures key fields
- `risk_engine.py`: maps findings to risk tiers
- `groq_explainer.py`: optional LLM-based summary (if enabled)

## Pipeline flow
1) Accept file or raw text.
2) Extract and clean text.
3) Parse values and sections.
4) Score and prioritize risks.
5) Optionally generate a narrative explanation.

## API endpoint
`POST /api/reports/analyze`

Typical response includes:
- Normalized findings
- Abnormal flags
- Risk tiers
- Optional explanation

## Environment settings
- `GROQ_API_KEY` enables Groq explanation output.

## Error handling
The endpoint returns clear messages for:
- Empty or invalid files
- Missing dependencies (like pdfplumber)
- Missing or invalid API keys
