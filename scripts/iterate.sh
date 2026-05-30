#!/usr/bin/env bash
#
# iterate.sh — Edit → build → test → report loop
#
# Usage:
#   ./scripts/iterate.sh [--target <target.png>] [--max-iterations <N>]
#
# Prerequisites:
#   - Dev server running (npm run dev) or Playwright will auto-start it
#   - OPENAI_API_KEY or ANTHROPIC_API_KEY set for judge.mjs
#
# The loop:
#   1. Run Playwright tests (visual + layout + accessibility + console)
#   2. If visual tests fail, run judge.mjs on failed screenshots
#   3. Print structured report
#   4. Exit with code 0 (all pass) or 1 (failures found)

set -euo pipefail

MAX_ITERATIONS=1
TARGET=""
REPORT_DIR="tests/reports"

while [[ $# -gt 0 ]]; do
  case $1 in
    --max-iterations) MAX_ITERATIONS="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    --report-dir) REPORT_DIR="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$REPORT_DIR"

echo "=== Iterate: running Playwright tests ==="
echo "Max iterations: $MAX_ITERATIONS"

ITERATION=0
ALL_PASSED=false

while [[ $ITERATION -lt $MAX_ITERATIONS ]]; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "--- Iteration $ITERATION / $MAX_ITERATIONS ---"

  # Run all Playwright tests
  TEST_EXIT_CODE=0
  npx playwright test --reporter=list 2>&1 | tee "$REPORT_DIR/test-run-$ITERATION.log" || TEST_EXIT_CODE=$?

  if [[ $TEST_EXIT_CODE -eq 0 ]]; then
    echo ""
    echo "✅ All tests passed on iteration $ITERATION"
    ALL_PASSED=true
    break
  fi

  echo ""
  echo "❌ Tests failed (exit code $TEST_EXIT_CODE)"

  # If visual tests failed and we have a target, run the judge
  if [[ -n "$TARGET" && -f "$TARGET" ]]; then
    echo ""
    echo "=== Running vision judge ==="

    # Find the latest screenshot diff
    FAIL_DIR="tests/snapshots"
    if [[ -d "$FAIL_DIR" ]]; then
      # Find actual diff images from test failures
      DIFF_IMAGES=$(find "$FAIL_DIR" -name "*-diff.png" -newer "$REPORT_DIR" 2>/dev/null | head -5 || true)

      if [[ -n "$DIFF_IMAGES" ]]; then
        for DIFF_IMG in $DIFF_IMAGES; do
          BASENAME=$(basename "$DIFF_IMG" -diff.png)
          ACTUAL_IMG=$(find "$FAIL_DIR" -name "${BASENAME}-actual.png" -o -name "${BASENAME}.png" 2>/dev/null | head -1 || true)

          if [[ -n "$ACTUAL_IMG" ]]; then
            echo "Judging: $TARGET vs $ACTUAL_IMG"
            node scripts/judge.mjs --target "$TARGET" --impl "$ACTUAL_IMG" 2>&1 | tee "$REPORT_DIR/judge-$ITERATION-$BASENAME.json" || true
          fi
        done
      else
        # No diff images, try comparing target against Playwright failure screenshots
        IMPL_SCREENSHOT=$(find test-results -name "*.png" 2>/dev/null | head -1 || true)
        if [[ -n "$IMPL_SCREENSHOT" ]]; then
          echo "Judging: $TARGET vs $IMPL_SCREENSHOT"
          node scripts/judge.mjs --target "$TARGET" --impl "$IMPL_SCREENSHOT" 2>&1 | tee "$REPORT_DIR/judge-$ITERATION.json" || true
        else
          echo "No implementation screenshots found for judge comparison"
        fi
      fi
    else
      echo "No snapshot diff directory found"
    fi
  fi

  # In a real iteration loop, the agent would edit code here
  # For now, we just report and stop
  if [[ $MAX_ITERATIONS -eq 1 ]]; then
    break
  fi

  echo ""
  echo "Waiting for code changes before next iteration..."
  echo "(In agent-driven mode, the agent edits code and re-runs)"
done

echo ""
echo "=== Final Report ==="
if [[ "$ALL_PASSED" == true ]]; then
  echo "✅ All tests passed"
  exit 0
else
  echo "❌ Tests still failing after $ITERATION iteration(s)"
  echo "See reports in: $REPORT_DIR/"
  exit 1
fi