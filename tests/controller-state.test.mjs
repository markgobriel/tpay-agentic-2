import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const script = join(process.cwd(), "scripts/controller-state.mjs");

function fixture(status = "active") {
  const directory = mkdtempSync(join(tmpdir(), "home-rhythm-controller-"));
  mkdirSync(join(directory, ".agent"));
  writeFileSync(join(directory, ".agent/state.json"), JSON.stringify({ projectStatus: status, blockers: [] }));
  return directory;
}

test("controller state guard permits only active projects", () => {
  const active = fixture();
  execFileSync(process.execPath, [script, "assert-active"], { cwd: active });
  const blocked = fixture("blocked");
  const result = spawnSync(process.execPath, [script, "assert-active"], { cwd: blocked, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /projectStatus is blocked/);
});

test("controller records a durable blocker without dropping existing fields", () => {
  const directory = fixture();
  execFileSync(process.execPath, [script, "mark-blocked", "Codex is unavailable"], { cwd: directory });
  const state = JSON.parse(readFileSync(join(directory, ".agent/state.json"), "utf8"));
  assert.equal(state.projectStatus, "blocked");
  assert.deepEqual(state.blockers, ["Codex is unavailable"]);
  assert.equal(state.lastControllerBlocker.summary, "Codex is unavailable");
  assert.match(state.lastControllerBlocker.recordedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("controller persists its validation result for the next worker", () => {
  const directory = fixture();
  execFileSync(process.execPath, [script, "record-validation", "failed"], { cwd: directory });
  const state = JSON.parse(readFileSync(join(directory, ".agent/state.json"), "utf8"));
  assert.equal(state.lastControllerValidation.result, "failed");
  assert.match(state.lastControllerValidation.recordedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("controller failure counts survive restart-equivalent state reloads and reset after success", () => {
  const directory = fixture();
  assert.equal(execFileSync(process.execPath, [script, "record-cli-failure"], { cwd: directory, encoding: "utf8" }).trim(), "1");
  assert.equal(execFileSync(process.execPath, [script, "record-cli-failure"], { cwd: directory, encoding: "utf8" }).trim(), "2");
  execFileSync(process.execPath, [script, "reset-cli-failures"], { cwd: directory });
  const state = JSON.parse(readFileSync(join(directory, ".agent/state.json"), "utf8"));
  assert.equal(state.consecutiveControllerFailures, 0);
});
