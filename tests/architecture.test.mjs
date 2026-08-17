import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("architecture boundary check accepts the initial modular skeleton", () => {
  const output = execFileSync(process.execPath, ["scripts/architecture-check.mjs"], { encoding: "utf8" });
  assert.match(output, /Architecture check passed/);
});

test("architecture boundary check rejects domain imports from outer layers", () => {
  const fixture = mkdtempSync(join(tmpdir(), "home-rhythm-domain-"));
  writeFileSync(join(fixture, "invalid.ts"), 'import { view } from "../web/view.js";\nexport { view };\n');
  const result = spawnSync(process.execPath, ["scripts/architecture-check.mjs", fixture], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Domain boundary violations/);
});

test("architecture boundary check rejects a missing or empty domain layer", () => {
  const fixture = mkdtempSync(join(tmpdir(), "home-rhythm-empty-domain-"));
  const result = spawnSync(process.execPath, ["scripts/architecture-check.mjs", fixture], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires at least one domain TypeScript file/);
});
