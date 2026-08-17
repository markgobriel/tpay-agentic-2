import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { nextDueDate } from "../dist/domain/routine.js";

const page = readFileSync("src/web/index.html", "utf8");
const routines = [];
const send = (response, status, body, type = "application/json") => response.writeHead(status, { "content-type": type }).end(type === "application/json" ? JSON.stringify(body) : body);

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/") return send(response, 200, page, "text/html; charset=utf-8");
  if (request.method === "GET" && request.url === "/api/routines") return send(response, 200, routines);
  if (request.method === "POST" && request.url === "/api/routines") {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    try {
      const input = JSON.parse(raw);
      const schedule = input.kind === "interval" ? { kind: "interval", days: Number(input.days) } : { kind: input.kind };
      const routine = { id: crypto.randomUUID(), name: input.name, area: input.area, createdOn: input.createdOn, schedule, active: true, completions: [] };
      const nextDue = nextDueDate(routine);
      routines.push({ ...routine, nextDue });
      return send(response, 201, { ...routine, nextDue });
    } catch (error) { return send(response, 400, { error: error instanceof Error ? error.message : "Invalid routine" }); }
  }
  return send(response, 404, { error: "Not found" });
}).listen(4173, () => console.log("Home Rhythm preview: http://localhost:4173"));
