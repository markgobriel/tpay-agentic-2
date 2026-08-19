import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const port = 4174;
let server;
const dataFile = join(mkdtempSync(join(tmpdir(), "home-rhythm-routines-")), "routines.json");

async function startServer() {
  server = spawn(process.execPath, ["scripts/dev.mjs"], { env: { ...process.env, PORT: String(port), HOME_RHYTHM_DATA_FILE: dataFile }, stdio: "ignore" });
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { await fetch(`http://localhost:${port}/api/routines`); return; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  throw new Error("Preview API did not start");
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  await new Promise((resolve) => {
    server.once("exit", resolve);
    server.kill();
  });
}

test.before(async () => {
  await startServer();
});

test.after(stopServer);

test("uses the browser's local calendar fields instead of a UTC ISO date when creating a routine", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  const source = page.match(/const localCalendarDate=(now=>[^;]+);/)?.[1];
  assert.ok(source);
  const localCalendarDate = Function(`return (${source})`)();
  assert.equal(localCalendarDate({ getFullYear: () => 2026, getMonth: () => 7, getDate: () => 18 }), "2026-08-18");
  assert.match(page, /createdOn:localCalendarDate\(new Date\(\)\)/);
  assert.doesNotMatch(page, /createdOn:new Date\(\)\.toISOString\(\)\.slice\(0,10\)/);
});

test("keeps creation and edit validation errors in the relevant form and returns focus to the invalid field", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  assert.match(page, /const validateRoutineForm=\(error,fields\)=>\{clearFieldErrors\(fields\);if\(!fields\.name\.value\.trim\(\)\)\{showFieldError\(error,fields\.name,'Enter what needs doing\.'/);
  assert.match(page, /showFieldError\(error,fields\.area,'Enter where this routine belongs\.'/);
  assert.match(page, /showFieldError\(error,fields\.days,'Enter a whole number of days greater than zero\.'/);
  assert.match(page, /field\.setAttribute\('aria-invalid','true'\);field\.setAttribute\('aria-describedby',error\.id\);field\.focus\(\)/);
  assert.match(page, /error\.id='edit-error-'\+item\.id;error\.setAttribute\('role','status'\)/);
  assert.match(page, /if\(!validateRoutineForm\(error,fields\)\)return;const response=await fetch\('\/api\/routines\/'\+item\.id/);
  assert.match(page, /if\(!validateRoutineForm\(message,fields\)\)return;message\.textContent='Adding routine…'/);
  assert.match(page, /form\.reset\(\);clearFieldErrors\(fields\);showInterval/);
});

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
    schedule: { kind: "monthly" }, active: true, completions: [], nextDue: "2026-02-28", status: "due", dueContext: "Due since 2026-02-28", latestCompletion: null, completionHistory: []
  });
});

test("returns domain-owned due context for routines due today and earlier", async () => {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const createdOn = new Date(`${localDate}T00:00:00.000Z`);
  createdOn.setUTCDate(createdOn.getUTCDate() - 1);
  const dueToday = await fetch(`http://localhost:${port}/api/routines`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Wipe counter", area: "Kitchen", kind: "daily", createdOn: createdOn.toISOString().slice(0, 10) })
  }).then((response) => response.json());
  createdOn.setUTCDate(createdOn.getUTCDate() - 1);
  const dueEarlier = await fetch(`http://localhost:${port}/api/routines`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Sort entry shelf", area: "Entry", kind: "daily", createdOn: createdOn.toISOString().slice(0, 10) })
  }).then((response) => response.json());
  assert.equal(dueToday.dueContext, "Due today");
  assert.equal(dueEarlier.dueContext, `Due since ${dueEarlier.nextDue}`);
  assert.match(readFileSync("src/web/index.html", "utf8"), /badge\.textContent=item\.dueContext\?dueContext\(item\.dueContext\):labels\[status\]/);
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

test("lists routine views in the domain-derived next-due order", async () => {
  const create = async (name, createdOn, kind = "daily") => fetch(`http://localhost:${port}/api/routines`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, area: "Order test", kind, createdOn })
  });
  await create("Later order check", "2099-01-01", "weekly");
  await create("Alpha order check", "2026-01-30");
  await create("Beta order check", "2026-01-30");
  const listed = await fetch(`http://localhost:${port}/api/routines`).then((response) => response.json());
  const orderedNames = listed.filter((routine) => routine.area === "Order test").map((routine) => routine.name);
  assert.deepEqual(orderedNames, ["Alpha order check", "Beta order check", "Later order check"]);
  assert.match(readFileSync("src/web/index.html", "utf8"), /const render=items=>\{/);
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
  assert.deepEqual(result.completionHistory, [localDate]);
  assert.equal(result.latestCompletion, localDate);
  assert.equal(result.status, "upcoming");
  assert.equal(result.nextDue, tomorrow.toISOString().slice(0, 10));
  assert.notEqual(result.nextDue, dueRoutine.nextDue);
});

test("records an early completion for an upcoming active routine and recalculates its next due date", async () => {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(`${localDate}T00:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const upcomingRoutine = await fetch(`http://localhost:${port}/api/routines`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Water balcony plants", area: "Balcony", kind: "weekly", createdOn: yesterday.toISOString().slice(0, 10) })
  }).then((response) => response.json());
  assert.equal(upcomingRoutine.status, "upcoming");
  const completedResponse = await fetch(`http://localhost:${port}/api/routines/${upcomingRoutine.id}/completions`, { method: "POST" });
  assert.equal(completedResponse.status, 201);
  const completed = await completedResponse.json();
  const nextWeek = new Date(`${localDate}T00:00:00.000Z`);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  assert.deepEqual(completed.completions, [localDate]);
  assert.equal(completed.latestCompletion, localDate);
  assert.equal(completed.nextDue, nextWeek.toISOString().slice(0, 10));
  assert.equal(completed.status, "upcoming");
  assert.notEqual(completed.nextDue, upcomingRoutine.nextDue);
});

test("renders completion controls for every active card but not paused cards", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  assert.match(page, /if\(item\.active\)card\.append\(complete\)/);
  assert.doesNotMatch(page, /if\(item\.status==='due'\)card\.append\(complete\)/);
});

test("gives every routine-card action an accessible name that identifies its routine", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  assert.match(page, /const actionLabel=\(button,action,item\)=>\{button\.setAttribute\('aria-label',action\+': '\+item\.name\);return button\}/);
  for (const action of ["Mark complete", "Edit routine", "Remove routine", "Save changes", "Cancel editing", "Show completion history", "Cancel removal", "Confirm removal"]) {
    assert.match(page, new RegExp(`actionLabel\\([^,]+,'${action}',item\\)`));
  }
  assert.match(page, /actionLabel\(toggle,toggle\.textContent,item\)/);
  assert.match(page, /actionLabel\(historyButton,historyButton\.textContent,item\)/);
});

test("lets users cancel an inline edit without saving and returns focus to its trigger", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  assert.match(page, /const editForm=\(item,trigger\)=>/);
  assert.match(page, /cancel\.type='button';cancel\.textContent='Cancel';actionLabel\(cancel,'Cancel editing',item\);cancel\.onclick=\(\)=>\{editor\.hidden=true;trigger\.focus\(\)\}/);
  assert.match(page, /const editor=editForm\(item,edit\);edit\.onclick=\(\)=>\{editor\.hidden=!editor\.hidden/);
  assert.match(page, /cancel\.onclick=\(\)=>\{editor\.hidden=true;trigger\.focus\(\)\};save\.type='submit'/);
});

test("moves focus to the visible result after a successful routine-card action refreshes Today", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  assert.match(page, /<p id="message" role="status" tabindex="-1"><\/p>/);
  assert.match(page, /const showActionResult=async text=>\{message\.textContent=text;await load\(\);message\.focus\(\)\}/);
  assert.match(page, /await showActionResult\('Routine updated\.'\)/);
  assert.match(page, /await showActionResult\('Routine removed\.'\)/);
  assert.match(page, /await showActionResult\(item\.active\?'Routine paused\.'\:'Routine resumed\.'\)/);
  assert.match(page, /await showActionResult\('Routine completed\.'\)/);
  assert.doesNotMatch(readFileSync("src/server/app.mjs", "utf8"), /showActionResult|message\.focus/);
});

test("renders removal confirmation as a described alert dialog and returns focus to its trigger", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  assert.match(page, /confirmation\.setAttribute\('role','alertdialog'\)/);
  assert.match(page, /confirmation\.setAttribute\('aria-label','Remove routine: '\+item\.name\)/);
  assert.match(page, /confirmation\.setAttribute\('aria-describedby',promptId\)/);
  assert.doesNotMatch(page, /confirmation\.setAttribute\('aria-labelledby',promptId\)/);
  assert.match(page, /confirmation\.onclose=\(\)=>trigger\.focus\(\)/);
});

test("renders completion history controls only when the card has completion data", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  assert.match(page, /const historyControls=item\.completionHistory\.length\?\(\(\)=>/);
  assert.doesNotMatch(page, /const historyControls=item\.completionHistory\.length\?\[\(/);
  assert.match(page, /card\.append\(badge,title,detail,history,\.\.\.historyControls\)/);
  assert.match(page, /historyButton\.setAttribute\('aria-controls',historyId\)/);
});

test("renders an accessible area filter that only narrows fetched routine views", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  assert.match(page, /<label for="areaFilterSelect">Focus on an area<\/label>/);
  assert.match(page, /<option value="">All areas<\/option>/);
  assert.match(page, /areas=\[\.\.\.new Set\(items\.map\(item=>item\.area\)\)\]\.sort/);
  assert.match(page, /const selectedArea=areaFilterSelect\.value,areas=/);
  assert.match(page, /areaFilterSelect\.value=areas\.includes\(selectedArea\)\?selectedArea:''/);
  assert.match(page, /const selectedArea=areaFilterSelect\.value,visibleItems=selectedArea\?items\.filter\(item=>item\.area===selectedArea\):items/);
  assert.match(page, /areaFilterSelect\.onchange=\(\)=>render\(routineItems\)/);
});

test("shows the current Today view count for all, selected, and empty areas", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  const source = page.match(/const visibleCountContext=(\(count,area\)=>[^;]+);/)?.[1];
  assert.ok(source);
  const visibleCountContext = Function(`return ${source}`)();
  assert.equal(visibleCountContext(3, ""), "3 routines shown.");
  assert.equal(visibleCountContext(1, "Kitchen"), "1 routine shown in Kitchen.");
  assert.equal(visibleCountContext(0, "Garage"), "0 routines shown in Garage.");
  assert.match(page, /<p id="viewSummary" class="view-summary" role="status">0 routines shown\.<\/p>/);
  assert.match(page, /const selectedArea=areaFilterSelect\.value,visibleItems=selectedArea\?items\.filter\(item=>item\.area===selectedArea\):items;viewSummary\.textContent=visibleCountContext\(visibleItems\.length,selectedArea\)/);
  assert.match(page, /No routines in '\+selectedArea\+'\. Choose All areas to see every routine\./);
  assert.doesNotMatch(readFileSync("src/server/app.mjs", "utf8"), /visibleCountContext|viewSummary/);
});

test("renders reader-friendly schedule context on routine cards", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  const source = page.match(/const scheduleContext=(schedule=>[^;]+);/)?.[1];
  assert.ok(source);
  const scheduleContext = Function(`return (${source})`)();
  assert.equal(scheduleContext({ kind: "daily" }), "Daily");
  assert.equal(scheduleContext({ kind: "weekly" }), "Weekly");
  assert.equal(scheduleContext({ kind: "monthly" }), "Monthly");
  assert.equal(scheduleContext({ kind: "interval", days: 3 }), "Every 3 days");
  assert.match(page, /detail\.textContent=item\.area\+' · '\+scheduleContext\(item\.schedule\)\+' · '\+scheduleDateContext\(item\)/);
  assert.doesNotMatch(page, /item\.schedule\.kind\+\(item\.schedule\.kind==='interval'/);
});

test("describes a paused card's retained schedule as applying when resumed", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  const source = page.match(/const scheduleDateContext=(item=>[^;]+);/)?.[1];
  assert.ok(source);
  const scheduleDateContext = Function("calendarDateContext", `return (${source})`)((date) => `date:${date}`);
  assert.equal(scheduleDateContext({ active: true, nextDue: "2026-08-25" }), "Next due date:2026-08-25");
  assert.equal(scheduleDateContext({ active: false, nextDue: "2026-08-25" }), "Scheduled for date:2026-08-25 when resumed");
  assert.match(page, /detail\.textContent=item\.area\+' · '\+scheduleContext\(item\.schedule\)\+' · '\+scheduleDateContext\(item\)/);
  assert.doesNotMatch(page, /item\.status==='paused'.*Next due/);
  assert.doesNotMatch(readFileSync("src/server/app.mjs", "utf8"), /scheduleDateContext/);
});

test("renders readable exact calendar dates without putting date calculations in the boundary", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  const source = page.match(/const calendarDateContext=(date=>[^;]+);/)?.[1];
  assert.ok(source);
  assert.match(source, /timeZone:'UTC'/);
  const calendarDateContext = Function(`return (${source})`)();
  assert.equal(calendarDateContext("2026-08-18"), "Aug 18, 2026 (2026-08-18)");
  assert.match(page, /const dueContext=context=>context\.startsWith\('Due since '\)\?'Due since '\+calendarDateContext/);
  assert.match(page, /Next due '\+calendarDateContext\(item\.nextDue\)/);
  assert.match(page, /Last completed '\+calendarDateContext\(item\.latestCompletion\)/);
  assert.match(page, /'Completed '\+calendarDateContext\(date\)/);
  assert.doesNotMatch(readFileSync("src/server/app.mjs", "utf8"), /Intl\.DateTimeFormat/);
});

test("resets the interval-only control after routine creation", () => {
  const page = readFileSync("src/web/index.html", "utf8");
  assert.match(page, /message\.textContent='Routine added\.';form\.reset\(\);clearFieldErrors\(fields\);showInterval\(kind,daysLabel,days\);await load\(\)/);
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

test("removes an obsolete routine through the HTTP boundary", async () => {
  const created = await fetch(`http://localhost:${port}/api/routines`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Old moving checklist", area: "Hall", kind: "weekly", createdOn: "2026-01-30" })
  }).then((response) => response.json());
  const removed = await fetch(`http://localhost:${port}/api/routines/${created.id}`, { method: "DELETE" });
  assert.equal(removed.status, 204);
  const routines = await fetch(`http://localhost:${port}/api/routines`).then((response) => response.json());
  assert.equal(routines.some((routine) => routine.id === created.id), false);
  const missing = await fetch(`http://localhost:${port}/api/routines/${created.id}`, { method: "DELETE" });
  assert.equal(missing.status, 404);
  assert.match((await missing.json()).error, /Routine not found/);
});

test("keeps completed and paused routines after a server restart", async () => {
  const created = await fetch(`http://localhost:${port}/api/routines`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Change hallway filter", area: "Hall", kind: "monthly", createdOn: "2026-01-30" })
  }).then((response) => response.json());
  const completed = await fetch(`http://localhost:${port}/api/routines/${created.id}/completions`, { method: "POST" }).then((response) => response.json());
  const updated = await fetch(`http://localhost:${port}/api/routines/${created.id}`, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Replace hallway filter", area: "Entry", kind: "interval", days: 14 })
  }).then((response) => response.json());
  const paused = await fetch(`http://localhost:${port}/api/routines/${created.id}`, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: false })
  }).then((response) => response.json());
  await stopServer();
  await startServer();
  const restored = (await fetch(`http://localhost:${port}/api/routines`).then((response) => response.json())).find((routine) => routine.id === created.id);
  assert.deepEqual(restored.completions, completed.completions);
  assert.deepEqual(restored.completionHistory, completed.completionHistory);
  assert.equal(restored.name, updated.name);
  assert.equal(restored.area, updated.area);
  assert.deepEqual(restored.schedule, updated.schedule);
  assert.equal(restored.active, false);
  assert.equal(restored.status, "paused");
  assert.equal(restored.nextDue, paused.nextDue);
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
