import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { assertRoutine } from "../../dist/domain/routine.js";

export class FileRoutineRepository {
  constructor(filePath) {
    this.filePath = resolve(filePath);
  }

  list() {
    if (!existsSync(this.filePath)) return [];
    const routines = JSON.parse(readFileSync(this.filePath, "utf8"));
    if (!Array.isArray(routines)) throw new Error("Routine storage must contain a routine list");
    routines.forEach(assertRoutine);
    return routines;
  }

  replace(routines) {
    routines.forEach(assertRoutine);
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(routines, null, 2)}\n`);
    renameSync(temporaryPath, this.filePath);
  }
}
