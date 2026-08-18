import { readFileSync, watchFile } from "node:fs";

const logPath = ".agent/logs/controller.ndjson";
const follow = process.argv.includes("--follow");
let offset = 0;

function oneLine(value) {
  const compact = String(value ?? "").replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}…` : compact;
}

function describe(entry) {
  if (entry.event) return `[${entry.at ?? "now"}] Controller: ${entry.event.replaceAll("_", " ")}${entry.detail ? ` — ${entry.detail}` : ""}`;
  if (entry.type === "item.completed" && entry.item?.type === "agent_message") return `Agent: ${oneLine(entry.item.text)}`;
  if (entry.type === "item.completed" && entry.item?.type === "file_change") {
    const files = entry.item.changes?.map((change) => `${change.kind} ${change.path.split("/").at(-1)}`).join(", ");
    return `Changed: ${files}`;
  }
  if (entry.type === "item.completed" && entry.item?.type === "command_execution") {
    return `Check ${entry.item.status}: ${oneLine(entry.item.command)}`;
  }
  if (entry.type === "turn.completed") return "Agent turn completed; controller will validate and reassess saved state.";
  return null;
}

function entriesFrom(content) {
  return content.split("\n").flatMap((line) => {
    try {
      const description = describe(JSON.parse(line));
      return description ? [description] : [];
    } catch {
      return [];
    }
  });
}

function currentLog() {
  try { return readFileSync(logPath, "utf8"); } catch { return ""; }
}

const initial = currentLog();
offset = Buffer.byteLength(initial);
const activity = entriesFrom(initial);
console.log(activity.slice(-12).join("\n") || "No controller activity has been recorded yet.");

if (follow) {
  console.log("\nWatching readable controller activity. Press Ctrl+C to stop.");
  watchFile(logPath, { interval: 500 }, () => {
    const content = currentLog();
    const added = Buffer.from(content).subarray(offset).toString();
    offset = Buffer.byteLength(content);
    for (const line of entriesFrom(added)) console.log(line);
  });
}
