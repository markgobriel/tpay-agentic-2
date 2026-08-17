import { readFileSync } from "node:fs";

const state = JSON.parse(readFileSync(".agent/state.json", "utf8"));
const labels = {
  active: "ACTIVE",
  awaiting_initial_review: "AWAITING_REVIEW",
  blocked: "BLOCKED",
  complete: "COMPLETE"
};

console.log(`${labels[state.projectStatus] ?? "UNKNOWN"} — ${state.currentTaskId ?? "no current task"}`);
console.log(`Validation: ${state.lastValidation ?? "not yet run"}`);
console.log(`Verifier: ${state.lastVerifierVerdict ?? "not yet run"}`);
if (state.blockers.length > 0) console.log(`Blockers: ${state.blockers.join("; ")}`);
