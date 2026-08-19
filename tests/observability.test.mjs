import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("starts Elastic APM only when ELASTIC_APM_SERVER_URL is configured", () => {
  const bootstrap = readFileSync("scripts/start-apm.mjs", "utf8");
  assert.match(bootstrap, /process\.env\.ELASTIC_APM_SERVER_URL/);
  assert.match(bootstrap, /apm\.start\(/);
});

test("local preview loads APM bootstrap before the HTTP server", () => {
  const dev = readFileSync("scripts/dev.mjs", "utf8");
  const apmImport = dev.indexOf('import "./start-apm.mjs";');
  const serverImport = dev.indexOf('import { createRoutineApp }');
  assert.notEqual(apmImport, -1);
  assert.ok(apmImport < serverImport);
});

test("docker compose defines the app and Elastic observability stack", () => {
  const compose = readFileSync("docker-compose.yml", "utf8");
  for (const service of ["elasticsearch", "kibana", "apm-server", "app"]) {
    assert.match(compose, new RegExp(`\\b${service}:`));
  }
  assert.match(compose, /ELASTIC_APM_SERVER_URL: http:\/\/apm-server:8200/);
});
