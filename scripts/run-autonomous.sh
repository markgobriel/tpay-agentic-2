#!/usr/bin/env bash
set -euo pipefail

# Standalone, resumable controller for Codex CLI. It deliberately leaves product
# decisions to AGENTS.md, the backlog, and persisted state rather than encoding
# them in shell conditionals. Set HOME_RHYTHM_MAX_AUTONOMOUS_RUNS to a positive
# integer for a bounded operator run; the default continues until a terminal state.
max_runs="${HOME_RHYTHM_MAX_AUTONOMOUS_RUNS:-0}"
retry_limit="${HOME_RHYTHM_CONTROLLER_RETRY_LIMIT:-3}"
agent_bin="${HOME_RHYTHM_AGENT_BIN:-}"
agent_sandbox="${HOME_RHYTHM_AGENT_SANDBOX:-danger-full-access}"
log_file=".agent/logs/controller.ndjson"

if ! [[ "$max_runs" =~ ^[0-9]+$ ]] || ! [[ "$retry_limit" =~ ^[1-9][0-9]*$ ]] || ! [[ "$agent_sandbox" =~ ^(workspace-write|danger-full-access)$ ]]; then
  echo "Invalid controller configuration. Set a non-negative run cap, a positive retry limit, and HOME_RHYTHM_AGENT_SANDBOX to workspace-write or danger-full-access." >&2
  exit 2
fi

if [[ -z "$agent_bin" ]]; then
  if command -v codex >/dev/null 2>&1; then
    agent_bin="codex"
  elif [[ -x "/Applications/ChatGPT.app/Contents/Resources/codex" ]]; then
    agent_bin="/Applications/ChatGPT.app/Contents/Resources/codex"
  else
    echo "Codex CLI was not found. Install it or set HOME_RHYTHM_AGENT_BIN to its executable path." >&2
    exit 1
  fi
elif ! command -v "$agent_bin" >/dev/null 2>&1 && [[ ! -x "$agent_bin" ]]; then
  echo "HOME_RHYTHM_AGENT_BIN is not executable: $agent_bin" >&2
  exit 1
fi

mkdir -p "$(dirname "$log_file")"
node scripts/controller-state.mjs assert-active

log_event() {
  node -e 'process.stdout.write(JSON.stringify({ event: process.argv[1], at: new Date().toISOString(), detail: process.argv[2] }) + "\n")' "$1" "${2:-}" >> "$log_file"
}

mark_blocked() {
  local message="$1"
  node scripts/controller-state.mjs mark-blocked "$message"
  log_event "controller_blocked" "$message"
}

prompt="You are the Home Rhythm autonomous product controller worker. Read AGENTS.md and every required contract before doing anything. Inspect .agent/state.json and backlog. If lastControllerValidation is failed, diagnose and repair that validation failure before any product work. While state is active, take exactly one highest-priority unblocked, coherent task. Record a concise plan in its notes, implement it, add acceptance tests, run npm run validate, and for user-facing work capture real-browser desktop and mobile evidence with keyboard and console/network checks. Before completion, audit for guardrails required by docs/HARNESS_EVOLUTION.md and obtain a fresh read-only verifier review using the verifier prompt in AGENTS.md. Fix supported verifier findings, rerun validation, atomically update task, state, and evidence, then commit only your intentional changes. Do not modify unrelated existing work, weaken tests, cross architecture boundaries, or guess at human-only decisions. If blocked under docs/AUTONOMY.md, record exact evidence in .agent/state.json and stop. End after one task or a genuine blocker so this controller can safely reassess persisted state."

run=1
log_event "controller_started" "max_runs=$max_runs retry_limit=$retry_limit agent=$agent_bin sandbox=$agent_sandbox"
while ((max_runs == 0 || run <= max_runs)); do
  status="$(node -p 'JSON.parse(require("fs").readFileSync(".agent/state.json", "utf8")).projectStatus')"
  if [[ "$status" != "active" ]]; then
    log_event "controller_stopped" "projectStatus=$status"
    echo "Controller stopped: projectStatus is $status."
    exit 0
  fi

  log_event "agent_run_started" "run=$run"
  set +e
  "$agent_bin" exec --sandbox "$agent_sandbox" --json -C "$PWD" "$prompt" 2>&1 | tee -a "$log_file"
  agent_exit=${PIPESTATUS[0]}
  set -e

  if ((agent_exit != 0)); then
    failures="$(node scripts/controller-state.mjs record-cli-failure)"
    log_event "agent_run_failed" "run=$run exit=$agent_exit consecutive_failures=$failures"
    if ((failures >= retry_limit)); then
      mark_blocked "Codex CLI exited unsuccessfully $retry_limit times in a row. Inspect .agent/logs/controller.ndjson for captured errors."
      echo "Controller stopped after repeated CLI failures." >&2
      exit 1
    fi
    run=$((run + 1))
    continue
  fi

  node scripts/controller-state.mjs reset-cli-failures
  if ! npm run validate 2>&1 | tee -a "$log_file"; then
    node scripts/controller-state.mjs record-validation failed
    log_event "controller_validation_failed" "run=$run"
  else
    node scripts/controller-state.mjs record-validation passed
    log_event "controller_validation_passed" "run=$run"
  fi
  run=$((run + 1))
done

log_event "controller_run_cap_reached" "max_runs=$max_runs"
echo "Controller run cap reached while the project is still active. Run npm run autonomous again to continue."
