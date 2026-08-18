import { createServer } from "node:http";
import { completeRoutine, removeRoutine, routineView, routineViews, setRoutineActive, updateRoutineDetails } from "../../dist/domain/routine.js";
import { asRoutineRepository } from "../storage/routine-repository.mjs";

export function createRoutineHandler({ page, repository, localDate }) {
  const routines = asRoutineRepository(repository);
  const send = (response, status, body, type = "application/json") => response.writeHead(status, { "content-type": type }).end(type === "application/json" ? JSON.stringify(body) : body);
  const view = (routine) => routineView(routine, localDate());

  return async (request, response) => {
    if (request.method === "GET" && request.url === "/") return send(response, 200, page, "text/html; charset=utf-8");
    if (request.method === "GET" && request.url === "/api/routines") return send(response, 200, routineViews(routines.list(), localDate()));
    if (request.method === "POST" && request.url === "/api/routines") {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      try {
        const input = JSON.parse(raw);
        const schedule = input.kind === "interval" ? { kind: "interval", days: Number(input.days) } : { kind: input.kind };
        const routine = { id: crypto.randomUUID(), name: input.name, area: input.area, createdOn: input.createdOn, schedule, active: true, completions: [] };
        routines.replace([...routines.list(), routine]);
        return send(response, 201, view(routine));
      } catch (error) { return send(response, 400, { error: error instanceof Error ? error.message : "Invalid routine" }); }
    }
    const routineMatch = request.url?.match(/^\/api\/routines\/([^/]+)$/);
    if (request.method === "PATCH" && routineMatch) {
      const routineList = routines.list();
      const routineIndex = routineList.findIndex((routine) => routine.id === routineMatch[1]);
      if (routineIndex === -1) return send(response, 404, { error: "Routine not found" });
      let raw = "";
      for await (const chunk of request) raw += chunk;
      try {
        const input = JSON.parse(raw);
        if (typeof input.active === "boolean") {
          routineList[routineIndex] = setRoutineActive(routineList[routineIndex], input.active);
        } else {
          if (typeof input.name !== "string" || typeof input.area !== "string") throw new Error("Routine name and area are required");
          const schedule = input.kind === "interval" ? { kind: "interval", days: Number(input.days) } : { kind: input.kind };
          routineList[routineIndex] = updateRoutineDetails(routineList[routineIndex], { name: input.name, area: input.area, schedule });
        }
        routines.replace(routineList);
        return send(response, 200, view(routineList[routineIndex]));
      } catch (error) { return send(response, 400, { error: error instanceof Error ? error.message : "Invalid routine" }); }
    }
    if (request.method === "DELETE" && routineMatch) {
      try {
        const updatedRoutines = removeRoutine(routines.list(), routineMatch[1]);
        routines.replace(updatedRoutines);
        return send(response, 204, null);
      } catch (error) { return send(response, 404, { error: error instanceof Error ? error.message : "Routine not found" }); }
    }
    const completionMatch = request.url?.match(/^\/api\/routines\/([^/]+)\/completions$/);
    if (request.method === "POST" && completionMatch) {
      const routineList = routines.list();
      const routineIndex = routineList.findIndex((routine) => routine.id === completionMatch[1]);
      if (routineIndex === -1) return send(response, 404, { error: "Routine not found" });
      try {
        routineList[routineIndex] = completeRoutine(routineList[routineIndex], localDate());
        routines.replace(routineList);
        return send(response, 201, view(routineList[routineIndex]));
      } catch (error) { return send(response, 400, { error: error instanceof Error ? error.message : "Invalid routine" }); }
    }
    return send(response, 404, { error: "Not found" });
  };
}

export function createRoutineApp(options) {
  return createServer(createRoutineHandler(options));
}
