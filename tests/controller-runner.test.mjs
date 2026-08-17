import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("autonomous command invokes the Bash controller and its syntax is valid", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(packageJson.scripts.autonomous, "bash scripts/run-autonomous.sh");
  execFileSync("bash", ["-n", "scripts/run-autonomous.sh"]);
});

test("missing CLI reaches the durable blocked state after three controller runs", () => {
  const directory = mkdtempSync(join(tmpdir(), "home-rhythm-runner-"));
  mkdirSync(join(directory, "scripts"));
  mkdirSync(join(directory, ".agent"));
  mkdirSync(join(directory, ".agent", "logs"));
  cpSync("scripts/run-autonomous.sh", join(directory, "scripts", "run-autonomous.sh"));
  cpSync("scripts/controller-state.mjs", join(directory, "scripts", "controller-state.mjs"));
  writeFileSync(join(directory, ".agent", "state.json"), JSON.stringify({ projectStatus: "active", blockers: [] }));
  const result = spawnSync("bash", [join(directory, "scripts", "run-autonomous.sh")], {
    cwd: directory,
    env: { ...process.env, HOME_RHYTHM_AGENT_BIN: "definitely-missing-codex", HOME_RHYTHM_MAX_AUTONOMOUS_RUNS: "3" }, encoding: "utf8"
  });
  assert.equal(result.status, 1);
  const state = JSON.parse(readFileSync(join(directory, ".agent", "state.json"), "utf8"));
  assert.equal(state.projectStatus, "blocked");
  assert.equal(state.consecutiveControllerFailures, 3);
});
