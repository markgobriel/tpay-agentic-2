import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("activity view turns controller JSON into concise readable updates", () => {
  const directory = mkdtempSync(join(tmpdir(), "home-rhythm-activity-"));
  mkdirSync(join(directory, ".agent", "logs"), { recursive: true });
  writeFileSync(join(directory, ".agent/logs/controller.ndjson"), [
    JSON.stringify({ event: "agent_run_started", at: "2026-08-18T08:12:00Z", detail: "run=1" }),
    JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "I will inspect\nstate first." } }),
    JSON.stringify({ type: "item.completed", item: { type: "file_change", changes: [{ kind: "update", path: "/tmp/src/web/index.html" }] } })
  ].join("\n"));
  const output = execFileSync(process.execPath, [join(process.cwd(), "scripts/activity.mjs")], { cwd: directory, encoding: "utf8" });
  assert.match(output, /Controller: agent run started/);
  assert.match(output, /Agent: I will inspect state first/);
  assert.match(output, /Changed: update index.html/);
});
