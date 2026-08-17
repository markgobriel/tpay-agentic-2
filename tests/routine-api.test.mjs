import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const port = 4174;
let server;

test.before(async () => {
  server = spawn(process.execPath, ["scripts/dev.mjs"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { await fetch(`http://localhost:${port}/api/routines`); return; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  throw new Error("Preview API did not start");
});

test.after(() => server.kill());

test("creates a routine through the HTTP boundary with a domain-calculated next date", async () => {
  const response = await fetch(`http://localhost:${port}/api/routines`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Clean fridge shelf", area: "Kitchen", kind: "monthly", createdOn: "2026-01-30" })
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    id: (await fetch(`http://localhost:${port}/api/routines`).then((r) => r.json()))[0].id,
    name: "Clean fridge shelf", area: "Kitchen", createdOn: "2026-01-30",
    schedule: { kind: "monthly" }, active: true, completions: [], nextDue: "2026-02-28", status: "due"
  });
});

test("lists domain-derived routine states and lets the boundary pause a routine", async () => {
  const created = await fetch(`http://localhost:${port}/api/routines`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Water plants", area: "Living room", kind: "weekly", createdOn: "2099-01-30" })
  }).then((response) => response.json());
  assert.equal(created.status, "upcoming");
  const paused = await fetch(`http://localhost:${port}/api/routines/${created.id}`, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: false })
  });
  assert.equal(paused.status, 200);
  assert.equal((await paused.json()).status, "paused");
  const routines = await fetch(`http://localhost:${port}/api/routines`).then((response) => response.json());
  assert.equal(routines.find((routine) => routine.id === created.id).status, "paused");
});

test("rejects an invalid custom schedule through the HTTP boundary", async () => {
  const response = await fetch(`http://localhost:${port}/api/routines`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Bad", area: "Kitchen", kind: "interval", days: 0, createdOn: "2026-01-30" })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /positive whole number/);
});

test("rejects an unsupported schedule through the HTTP boundary", async () => {
  const response = await fetch(`http://localhost:${port}/api/routines`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Bad", area: "Kitchen", kind: "other", createdOn: "2026-01-30" })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /daily, weekly, monthly, or interval/);
});
