import "./start-apm.mjs";
import { readFileSync } from "node:fs";
import { createRoutineApp } from "../src/server/app.mjs";
import { FileRoutineRepository } from "../src/storage/file-routine-repository.mjs";

const page = readFileSync("src/web/index.html", "utf8");
const repository = new FileRoutineRepository(process.env.HOME_RHYTHM_DATA_FILE ?? "data/routines.json");
const port = Number(process.env.PORT ?? 4173);
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

createRoutineApp({ page, repository, localDate }).listen(port, () => console.log(`Home Rhythm preview: http://localhost:${port}`));
