#!/usr/bin/env bash
# Run independent verification, then let Continue repair real failures (max 2 times).
# Only GitHub Actions may create the PR; the agent may not edit workflows.
set -euo pipefail

TEMP_DIR="$RUNNER_TEMP/issue-bot"
mkdir -p "$TEMP_DIR"
START_SHA="$GITHUB_SHA"
MAX_REPAIRS=2
CAVEMAN_SKILL="$RUNNER_TEMP/caveman-skill/.agents/skills/caveman/SKILL.md"
CONFIG_FILE="$(cat "$RUNNER_TEMP/issue-bot-config-used")"

case "$CONFIG_FILE" in
  .continue/config.yaml|.continue/config-sol.yaml) ;;
  *) echo "::error::Unexpected solve model config: $CONFIG_FILE"; exit 1 ;;
esac
test -s "$CAVEMAN_SKILL"
command -v rtk >/dev/null
command -v cn >/dev/null

repair_seconds=240
if [ "$CONFIG_FILE" = ".continue/config-sol.yaml" ]; then repair_seconds=360; fi

run_check() {
  local pass="$1" label="$2"
  shift 2
  local logfile="$TEMP_DIR/verify-$pass-$label.log"
  echo "::group::Verification pass $pass: $label"
  local code=0
  "$@" >"$logfile" 2>&1 || code=$?
  cat "$logfile"
  echo "::endgroup::"
  if [ "$code" -ne 0 ]; then
    echo "::warning::$label failed on verification pass $pass (exit $code)"
  fi
  return "$code"
}

validate_agent_changes() {
  if ! git merge-base --is-ancestor "$START_SHA" HEAD; then
    echo "::error::Continue switched to an unrelated commit; refusing changes."
    return 1
  fi
  local changed
  changed="$({ git diff --name-only "$START_SHA" HEAD; git diff --name-only; git diff --cached --name-only; git ls-files --others --exclude-standard; } | sort -u)"
  if printf '%s\n' "$changed" | grep -q '^\.github/workflows/'; then
    echo "::error::Issue-bot may never modify .github/workflows/."
    return 1
  fi
  # Convert agent commits into normal working-tree edits so PR action makes a
  # clean one-commit branch without pushing protected workflow history.
  if [ "$(git rev-parse HEAD)" != "$START_SHA" ]; then
    git reset --mixed "$START_SHA"
  fi
}

validate_agent_changes
for pass in 0 1 2; do
  install_status=0
  lint_status=0
  test_status=0
  build_status=0

  run_check "$pass" install npm --prefix escape-the-city ci || install_status=$?
  if [ "$install_status" -eq 0 ]; then
    run_check "$pass" lint npm --prefix escape-the-city run lint || lint_status=$?
    run_check "$pass" tests npm --prefix escape-the-city test || test_status=$?
    run_check "$pass" build npm --prefix escape-the-city run build || build_status=$?
  fi

  {
    echo "### Escape the City verification — pass $pass"
    echo "npm ci=$install_status, lint=$lint_status, tests=$test_status, build=$build_status"
  } >> "$GITHUB_STEP_SUMMARY"

  if [ "$install_status" -eq 0 ] && [ "$lint_status" -eq 0 ] &&
     [ "$test_status" -eq 0 ] && [ "$build_status" -eq 0 ]; then
    echo "All checks passed after $pass repair attempt(s)."
    {
      echo
      echo "## Validation"
      echo "npm ci, lint, Vitest and production build passed."
      echo "Automatic repair attempts: $pass."
    } >> "$TEMP_DIR/pr-body.md"
    exit 0
  fi

  if [ "$pass" -ge "$MAX_REPAIRS" ]; then
    echo "::error::Verification failed after $MAX_REPAIRS automatic repairs. No PR will be created."
    exit 1
  fi

  repair=$((pass + 1))
  prompt_file="$TEMP_DIR/repair-$repair-prompt.txt"
  {
    echo "Use Caveman. Use RTK."
    echo "You are repairing the existing changes for GitHub issue #$ISSUE_NUMBER: $ISSUE_TITLE."
    echo "The patch is already in the working tree. Fix the real lint/test/build failures below with the smallest correct changes."
    echo "Do not revert the requested feature, skip or weaken failing tests, hide errors, or bypass verification."
    echo "It is OK to fix a pre-existing broken test if that is blocking verification, but preserve the intended behavior."
    echo "Never modify .github/workflows/ or access secrets. Do not create branches, stage, commit, push or open PRs."
    echo "Use a focused investigation and run the failing check locally. The workflow will independently rerun all checks."
    echo "Failure statuses: install=$install_status lint=$lint_status tests=$test_status build=$build_status."
    echo "===== RELEVANT VERIFICATION LOGS (truncated) ====="
    for label in install lint tests build; do
      case "$label" in
        install) failed="$install_status" ;;
        lint)    failed="$lint_status" ;;
        tests)   failed="$test_status" ;;
        build)   failed="$build_status" ;;
      esac
      file="$TEMP_DIR/verify-$pass-$label.log"
      if [ "$failed" -ne 0 ] && [ -f "$file" ]; then
        echo "===== FAILED: $label ====="
        tail -n 100 "$file"
      fi
    done
  } >"$prompt_file"

  echo "Repair attempt $repair/$MAX_REPAIRS with $CONFIG_FILE (maximum $repair_seconds seconds)."
  echo "#### Automatic repair $repair" >> "$GITHUB_STEP_SUMMARY"
  code=0
  timeout --signal=TERM --kill-after=15s "$repair_seconds" \
    env -u GITHUB_TOKEN -u GH_TOKEN cn \
      --config "$CONFIG_FILE" \
      --rule .continue/rules/rtk.md \
      --rule "$CAVEMAN_SKILL" \
      --auto --allow Write --allow Edit --allow Bash \
      -p "$(cat "$prompt_file")" \
      >"$TEMP_DIR/repair-$repair.log" 2>&1 || code=$?
  tail -n 130 "$TEMP_DIR/repair-$repair.log"

  validate_agent_changes
  if [ "$code" -ne 0 ]; then
    echo "::error::Continue repair $repair failed or timed out (exit $code). No PR will be created."
    exit 1
  fi
done
