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
    schedule: { kind: "monthly" }, active: true, completions: [], nextDue: "2026-02-28", status: "due", latestCompletion: null
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

test("records a completion against the local boundary date and returns updated history", async () => {
  const dueRoutine = await fetch(`http://localhost:${port}/api/routines`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Empty kitchen bin", area: "Kitchen", kind: "daily", createdOn: "2026-01-30" })
  }).then((response) => response.json());
  assert.equal(dueRoutine.status, "due");
  const completed = await fetch(`http://localhost:${port}/api/routines/${dueRoutine.id}/completions`, { method: "POST" });
  assert.equal(completed.status, 201);
  const result = await completed.json();
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(`${localDate}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  assert.deepEqual(result.completions, [localDate]);
  assert.equal(result.latestCompletion, localDate);
  assert.equal(result.status, "upcoming");
  assert.equal(result.nextDue, tomorrow.toISOString().slice(0, 10));
  assert.notEqual(result.nextDue, dueRoutine.nextDue);
});

test("edits routine details through the HTTP boundary without rewriting completion history", async () => {
  const created = await fetch(`http://localhost:${port}/api/routines`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Dust shelf", area: "Study", kind: "daily", createdOn: "2026-01-30" })
  }).then((response) => response.json());
  const completed = await fetch(`http://localhost:${port}/api/routines/${created.id}/completions`, { method: "POST" }).then((response) => response.json());
  const editedResponse = await fetch(`http://localhost:${port}/api/routines/${created.id}`, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Dust bookcase", area: "Living room", kind: "monthly" })
  });
  assert.equal(editedResponse.status, 200);
  const edited = await editedResponse.json();
  assert.equal(edited.name, "Dust bookcase");
  assert.equal(edited.area, "Living room");
  assert.deepEqual(edited.completions, completed.completions);
  assert.equal(edited.schedule.kind, "monthly");
  const completedOn = completed.completions[0];
  const expected = new Date(`${completedOn}T00:00:00.000Z`);
  expected.setUTCMonth(expected.getUTCMonth() + 1);
  assert.equal(edited.nextDue, expected.toISOString().slice(0, 10));
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
