import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { completeRoutine, removeRoutine, routineView, setRoutineActive, updateRoutineDetails } from "../dist/domain/routine.js";

const page = readFileSync("src/web/index.html", "utf8");
const routines = [];
const send = (response, status, body, type = "application/json") => response.writeHead(status, { "content-type": type }).end(type === "application/json" ? JSON.stringify(body) : body);

const port = Number(process.env.PORT ?? 4173);
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const view = (routine) => routineView(routine, localDate());

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/") return send(response, 200, page, "text/html; charset=utf-8");
  if (request.method === "GET" && request.url === "/api/routines") return send(response, 200, routines.map(view));
  if (request.method === "POST" && request.url === "/api/routines") {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    try {
      const input = JSON.parse(raw);
      const schedule = input.kind === "interval" ? { kind: "interval", days: Number(input.days) } : { kind: input.kind };
      const routine = { id: crypto.randomUUID(), name: input.name, area: input.area, createdOn: input.createdOn, schedule, active: true, completions: [] };
      routines.push(routine);
      return send(response, 201, view(routine));
    } catch (error) { return send(response, 400, { error: error instanceof Error ? error.message : "Invalid routine" }); }
  }
  const routineMatch = request.url?.match(/^\/api\/routines\/([^/]+)$/);
  if (request.method === "PATCH" && routineMatch) {
    const routineIndex = routines.findIndex((routine) => routine.id === routineMatch[1]);
    if (routineIndex === -1) return send(response, 404, { error: "Routine not found" });
    let raw = "";
    for await (const chunk of request) raw += chunk;
    try {
      const input = JSON.parse(raw);
      if (typeof input.active === "boolean") {
        routines[routineIndex] = setRoutineActive(routines[routineIndex], input.active);
      } else {
        if (typeof input.name !== "string" || typeof input.area !== "string") throw new Error("Routine name and area are required");
        const schedule = input.kind === "interval" ? { kind: "interval", days: Number(input.days) } : { kind: input.kind };
        routines[routineIndex] = updateRoutineDetails(routines[routineIndex], { name: input.name, area: input.area, schedule });
      }
      return send(response, 200, view(routines[routineIndex]));
    } catch (error) { return send(response, 400, { error: error instanceof Error ? error.message : "Invalid routine" }); }
  }
  if (request.method === "DELETE" && routineMatch) {
    try {
      const updatedRoutines = removeRoutine(routines, routineMatch[1]);
      routines.splice(0, routines.length, ...updatedRoutines);
      return send(response, 204, null);
    } catch (error) { return send(response, 404, { error: error instanceof Error ? error.message : "Routine not found" }); }
  }
  const completionMatch = request.url?.match(/^\/api\/routines\/([^/]+)\/completions$/);
  if (request.method === "POST" && completionMatch) {
    const routineIndex = routines.findIndex((routine) => routine.id === completionMatch[1]);
    if (routineIndex === -1) return send(response, 404, { error: "Routine not found" });
    try {
      routines[routineIndex] = completeRoutine(routines[routineIndex], localDate());
      return send(response, 201, view(routines[routineIndex]));
    } catch (error) { return send(response, 400, { error: error instanceof Error ? error.message : "Invalid routine" }); }
  }
  return send(response, 404, { error: "Not found" });
}).listen(port, () => console.log(`Home Rhythm preview: http://localhost:${port}`));
