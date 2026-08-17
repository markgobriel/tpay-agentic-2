import assert from "node:assert/strict";
import test from "node:test";
import { completeRoutine, dueStatus, nextDueDate, routineView, setRoutineActive } from "../dist/domain/routine.js";

const routine = (schedule, overrides = {}) => ({
  id: "kitchen-bin",
  name: "Empty kitchen bin",
  area: "Kitchen",
  createdOn: "2026-01-30",
  schedule,
  active: true,
  completions: [],
  ...overrides
});

test("calculates daily, weekly, and interval routine dates", () => {
  assert.equal(nextDueDate(routine({ kind: "daily" })), "2026-01-31");
  assert.equal(nextDueDate(routine({ kind: "weekly" })), "2026-02-06");
  assert.equal(nextDueDate(routine({ kind: "interval", days: 3 })), "2026-02-02");
});

test("clamps monthly schedules at the end of short months and leap years", () => {
  assert.equal(nextDueDate(routine({ kind: "monthly" })), "2026-02-28");
  assert.equal(nextDueDate(routine({ kind: "monthly" }, { createdOn: "2024-01-30" })), "2024-02-29");
});

test("derives due status and keeps completion history immutable", () => {
  const source = routine({ kind: "daily" });
  assert.equal(dueStatus(source, "2026-01-31"), "due");
  const completed = completeRoutine(source, "2026-01-31");
  assert.deepEqual(source.completions, []);
  assert.deepEqual(completed.completions, ["2026-01-31"]);
  assert.equal(dueStatus(completed, "2026-01-31"), "upcoming");
  assert.equal(dueStatus(setRoutineActive(completed, false), "2026-02-10"), "paused");
});

test("provides a display-safe routine view with domain-owned due state", () => {
  const source = routine({ kind: "weekly" });
  assert.deepEqual(routineView(source, "2026-02-10"), { ...source, nextDue: "2026-02-06", status: "due", latestCompletion: null });
  assert.equal(routineView(setRoutineActive(source, false), "2026-02-10").status, "paused");
});

test("includes the latest immutable completion in the display-safe history context", () => {
  const completed = completeRoutine(routine({ kind: "weekly" }), "2026-02-06");
  assert.equal(routineView(completed, "2026-02-10").latestCompletion, "2026-02-06");
});

test("rejects invalid intervals and paused completion", () => {
  assert.throws(() => nextDueDate(routine({ kind: "interval", days: 0 })), /positive whole number/);
  assert.throws(() => completeRoutine(routine({ kind: "daily" }, { active: false }), "2026-01-31"), /Paused routines/);
});
