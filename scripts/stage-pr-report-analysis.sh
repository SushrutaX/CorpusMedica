#!/usr/bin/env bash
# Stage only files that belong to the Report Analysis PR.
# Run from repo root: ./scripts/stage-pr-report-analysis.sh

set -e
cd "$(dirname "$0")/.."

PR_FILES=(
  # Frontend – Report Analysis & main app
  "frontend/src/pages/ReportAnalysis.tsx"
  "frontend/src/pages/ReportAnalysis.css"
  "frontend/src/components/LabMarkerIcon.tsx"
  "frontend/src/App.tsx"
  "frontend/src/App.css"
  "frontend/src/main.tsx"
  "frontend/src/index.css"
  "frontend/package.json"
  "frontend/package-lock.json"
  "frontend/postcss.config.cjs"
  # Backend – Report analysis services & API
  "backend/app/api/routes/reports.py"
  "backend/app/api/routes/uploads.py"
  "backend/app/services/report_parser.py"
  "backend/app/services/report_text_extractor.py"
  "backend/app/services/risk_engine.py"
  "backend/app/services/reference_ranges.py"
  "backend/app/services/confidence_scorer.py"
  "backend/app/services/abnormality_prioritizer.py"
  "backend/app/services/risk_clusters.py"
  "backend/app/services/trend_analysis.py"
  "backend/app/services/report_storage.py"
  "backend/app/services/doctor_prompts.py"
  "backend/app/services/imaging_correlation.py"
  "backend/app/services/procedure_risk.py"
  "backend/app/services/digital_twin.py"
  "backend/app/services/population_insights.py"
  "backend/requirements.txt"
  # Documentation
  "ADVANCED_FEATURES_COMPLETE.md"
  "IMPLEMENTATION_STATUS.md"
  # PR description (optional; include so reviewers see scope)
  "PR_REPORT_ANALYSIS.md"
  "scripts/stage-pr-report-analysis.sh"
)

echo "Staging Report Analysis PR files..."
for f in "${PR_FILES[@]}"; do
  if [[ -e "$f" ]]; then
    git add "$f"
    echo "  + $f"
  else
    echo "  skip (missing): $f"
  fi
done
echo "Done. Run 'git status' to verify, then commit and push."
