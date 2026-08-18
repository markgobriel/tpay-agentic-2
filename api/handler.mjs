import { readFileSync } from "node:fs";
import { createRoutineHandler } from "../src/server/app.mjs";

let routines = [];
const page = readFileSync(new URL("../src/web/index.html", import.meta.url), "utf8");
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export default createRoutineHandler({
  page,
  repository: {
    list: () => routines,
    replace: (nextRoutines) => { routines = nextRoutines; }
  },
  localDate
});
