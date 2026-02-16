#!/usr/bin/env bash
# Undo the single Report Analysis commit and re-commit each file separately.
# Run from repo root: ./scripts/commit-report-analysis-separately.sh
# Requires: current branch has exactly one commit with all Report Analysis changes.

set -e
cd "$(dirname "$0")/.."

# Ordered list of files and their commit messages (one commit per file)
# Format: "file path|commit message"
COMMIT_LIST=(
  "frontend/src/pages/ReportAnalysis.tsx|feat(reports): add ReportAnalysis page with two-column layout and trend chart"
  "frontend/src/pages/ReportAnalysis.css|style(reports): add ReportAnalysis light theme and responsive styles"
  "frontend/src/components/LabMarkerIcon.tsx|style(reports): update LabMarkerIcon colors for light theme"
  "frontend/src/App.tsx|feat(app): add Report Analysis route and wiring"
  "frontend/src/App.css|style(app): update App styles"
  "frontend/src/main.tsx|chore(app): update main entry"
  "frontend/src/index.css|style(app): update index styles"
  "frontend/package.json|chore(frontend): add recharts dependency"
  "frontend/package-lock.json|chore(frontend): update package-lock for recharts"
  "frontend/postcss.config.cjs|chore(frontend): update postcss config"
  "backend/app/api/routes/reports.py|feat(api): reports API with advanced analysis features"
  "backend/app/api/routes/uploads.py|feat(api): update uploads for report flow"
  "backend/app/services/report_parser.py|feat(backend): report parser and demographics"
  "backend/app/services/report_text_extractor.py|feat(backend): report text extractor and OCR tracking"
  "backend/app/services/risk_engine.py|feat(backend): risk engine with prioritization and clusters"
  "backend/app/services/reference_ranges.py|feat(backend): personalized reference ranges"
  "backend/app/services/confidence_scorer.py|feat(backend): analysis confidence scoring"
  "backend/app/services/abnormality_prioritizer.py|feat(backend): abnormality prioritization"
  "backend/app/services/risk_clusters.py|feat(backend): pattern-based risk clusters"
  "backend/app/services/trend_analysis.py|feat(backend): trend analysis over time"
  "backend/app/services/report_storage.py|feat(backend): report storage for trends"
  "backend/app/services/doctor_prompts.py|feat(backend): doctor discussion prompts"
  "backend/app/services/imaging_correlation.py|feat(backend): imaging correlation service"
  "backend/app/services/procedure_risk.py|feat(backend): procedure and surgical risk flags"
  "backend/app/services/digital_twin.py|feat(backend): digital twin inputs export"
  "backend/app/services/population_insights.py|feat(backend): population-level insights"
  "backend/requirements.txt|chore(backend): update requirements"
  "ADVANCED_FEATURES_COMPLETE.md|docs: add advanced features completion summary"
  "IMPLEMENTATION_STATUS.md|docs: add implementation status"
  "PR_REPORT_ANALYSIS.md|docs: add PR description for Report Analysis"
  "scripts/stage-pr-report-analysis.sh|chore: add script to stage Report Analysis PR files"
  "scripts/commit-report-analysis-separately.sh|chore: add script to commit Report Analysis files separately"
)

echo "Undoing last commit (keeping changes)..."
git reset --soft HEAD~1
echo "Unstaging all files..."
git reset HEAD

COUNT=0
for entry in "${COMMIT_LIST[@]}"; do
  f="${entry%%|*}"
  msg="${entry#*|}"
  if [[ ! -e "$f" ]]; then
    echo "  skip (missing): $f"
    continue
  fi
  if git status --porcelain "$f" | grep -q .; then
    git add "$f"
    git commit -m "$msg"
    (( COUNT++ )) || true
    echo "  [$COUNT] $f"
  else
    echo "  skip (no changes): $f"
  fi
done

echo "Done. $COUNT commits created. Run 'git log --oneline -n $COUNT' to verify."
