# Test Suite for Report Analysis Features

## Overview

This test suite covers all the new report analysis features:
1. Personalized Reference Ranges
2. Analysis Confidence Scoring
3. Abnormality Prioritization
4. Pattern-Based Risk Clusters
5. Doctor-Discussion Prompts
6. Integration tests for the complete pipeline

## Running Tests

### Run all tests:
```bash
cd backend
python -m pytest tests/ -v
```

Or use the test runner:
```bash
cd backend
python run_tests.py
```

### Run specific test file:
```bash
python -m pytest tests/test_reference_ranges.py -v
```

### Run specific test:
```bash
python -m pytest tests/test_reference_ranges.py::TestReferenceRanges::test_glucose_fasting -v
```

### Run with coverage:
```bash
python -m pytest tests/ --cov=app/services --cov-report=html
```

## Test Files

### `test_reference_ranges.py`
Tests for personalized reference range calculations:
- Age-adjusted ranges (pediatric vs adult)
- Sex-specific ranges (hemoglobin, HDL)
- Fasting-status aware ranges (glucose, triglycerides)
- Value interpretation (normal, high, low)
- Personalized context inclusion

### `test_report_parser.py`
Tests for report text parsing:
- Lab value extraction
- Demographics extraction (age, sex, fasting status)
- Multiple test parsing
- Case-insensitive parsing

### `test_confidence_scorer.py`
Tests for confidence scoring:
- OCR quality assessment
- Data completeness scoring
- Value plausibility checks
- Overall confidence calculation

### `test_abnormality_prioritizer.py`
Tests for abnormality prioritization:
- Priority score calculation
- Urgency categorization
- Sorting by clinical importance
- Summary generation

### `test_risk_clusters.py`
Tests for risk cluster detection:
- Metabolic syndrome detection
- Diabetes risk detection
- Cardiovascular risk detection
- Kidney dysfunction detection
- Severe emergency detection

### `test_doctor_prompts.py`
Tests for doctor discussion prompt generation:
- Critical question generation
- High-priority question generation
- General question generation
- Follow-up question generation
- Guidance generation

### `test_integration_reports.py`
Integration tests for the complete API:
- Full pipeline testing
- Demographic override testing
- Abnormal value handling
- Normal value handling
- Pattern detection in real scenarios

**Note:** This test creates a minimal FastAPI app with only the reports router to avoid requiring torch/MONAI dependencies. It tests the report analysis API in isolation.

## Test Coverage

The test suite aims for:
- ✅ Unit tests for all services
- ✅ Edge case handling
- ✅ Integration tests for API endpoints
- ✅ Error handling validation

## Dependencies

Tests require:
- `pytest` - Test framework
- `pytest-asyncio` - Async test support
- `httpx` - HTTP client for API tests
- `fastapi` - For TestClient

All dependencies are in `requirements.txt`.

## Expected Results

When all tests pass, you should see:
```
============================= test session starts ==============================
collected X items

tests/test_reference_ranges.py::TestReferenceRanges::test_glucose_fasting PASSED
tests/test_reference_ranges.py::TestReferenceRanges::test_glucose_non_fasting PASSED
...
============================= X passed in X.XXs ==============================
```

## Troubleshooting

### Import errors:
- Make sure you're running from the `backend` directory
- Check that all dependencies are installed: `pip install -r requirements.txt`

### Test failures:
- Check that the services are properly imported
- Verify that all required dependencies are available
- Check for any environment-specific issues

### Integration test failures:
- Ensure the FastAPI app can be imported
- Check that all routes are properly registered
- Verify middleware configuration
