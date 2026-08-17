import { readFileSync, writeFileSync } from "node:fs";

const statePath = ".agent/state.json";
const state = JSON.parse(readFileSync(statePath, "utf8"));
const command = process.argv[2];

if (command === "assert-active") {
  if (state.projectStatus !== "active") {
    console.error(`Refusing to start: projectStatus is ${state.projectStatus}.`);
    process.exit(1);
  }
  process.exit(0);
}

if (command === "mark-blocked") {
  const summary = process.argv[3]?.trim();
  if (!summary) {
    console.error("A blocker summary is required.");
    process.exit(1);
  }
  state.projectStatus = "blocked";
  state.blockers = [...new Set([...(state.blockers ?? []), summary])];
  state.lastControllerBlocker = { summary, recordedAt: new Date().toISOString() };
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  process.exit(0);
}

if (command === "record-validation") {
  const result = process.argv[3];
  if (!['passed', 'failed'].includes(result)) {
    console.error("Validation result must be passed or failed.");
    process.exit(1);
  }
  state.lastControllerValidation = { result, recordedAt: new Date().toISOString() };
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  process.exit(0);
}

if (command === "record-cli-failure") {
  state.consecutiveControllerFailures = (state.consecutiveControllerFailures ?? 0) + 1;
  state.lastControllerFailureAt = new Date().toISOString();
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  console.log(state.consecutiveControllerFailures);
  process.exit(0);
}

if (command === "reset-cli-failures") {
  state.consecutiveControllerFailures = 0;
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  process.exit(0);
}

console.error("Usage: node scripts/controller-state.mjs <assert-active|mark-blocked|record-validation|record-cli-failure|reset-cli-failures> [value]");
process.exit(1);
