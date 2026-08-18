export type Schedule =
  | { kind: "daily" }
  | { kind: "weekly" }
  | { kind: "monthly" }
  | { kind: "interval"; days: number };

export type Routine = {
  id: string;
  name: string;
  area: string;
  createdOn: string;
  schedule: Schedule;
  active: boolean;
  completions: readonly string[];
};

export type RoutineDetails = Pick<Routine, "name" | "area" | "schedule">;

export type DueStatus = "paused" | "due" | "upcoming";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function asDate(date: string): Date {
  if (!isoDate.test(date)) throw new Error(`Expected local calendar date, received ${date}`);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) throw new Error(`Invalid calendar date: ${date}`);
  return parsed;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const next = asDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return formatDate(next);
}

function addMonth(date: string): string {
  const value = asDate(date);
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  return formatDate(value);
}

function latestCompletion(routine: Routine): string {
  return [...routine.completions, routine.createdOn].sort().at(-1) ?? routine.createdOn;
}

export function assertRoutine(routine: Routine): void {
  if (!routine.id || !routine.name.trim() || !routine.area.trim()) throw new Error("Routine needs an id, name, and area");
  asDate(routine.createdOn);
  routine.completions.forEach(asDate);
  if (!(["daily", "weekly", "monthly", "interval"] as string[]).includes(routine.schedule.kind)) {
    throw new Error("Routine schedule must be daily, weekly, monthly, or interval");
  }
  if (routine.schedule.kind === "interval" && (!Number.isInteger(routine.schedule.days) || routine.schedule.days < 1)) {
    throw new Error("Custom interval must be a positive whole number of days");
  }
}

export function nextDueDate(routine: Routine): string {
  assertRoutine(routine);
  const anchor = latestCompletion(routine);
  switch (routine.schedule.kind) {
    case "daily": return addDays(anchor, 1);
    case "weekly": return addDays(anchor, 7);
    case "monthly": return addMonth(anchor);
    case "interval": return addDays(anchor, routine.schedule.days);
  }
}

export function dueStatus(routine: Routine, today: string): DueStatus {
  asDate(today);
  if (!routine.active) return "paused";
  return nextDueDate(routine) <= today ? "due" : "upcoming";
}

export function completeRoutine(routine: Routine, completedOn: string): Routine {
  assertRoutine(routine);
  asDate(completedOn);
  if (!routine.active) throw new Error("Paused routines cannot be completed");
  if (routine.completions.includes(completedOn)) return routine;
  return { ...routine, completions: [...routine.completions, completedOn] };
}

export function setRoutineActive(routine: Routine, active: boolean): Routine {
  assertRoutine(routine);
  return { ...routine, active };
}

export function updateRoutineDetails(routine: Routine, details: RoutineDetails): Routine {
  assertRoutine(routine);
  const updated = { ...routine, ...details };
  assertRoutine(updated);
  return updated;
}

export function removeRoutine(routines: readonly Routine[], routineId: string): Routine[] {
  if (!routineId) throw new Error("Routine needs an id");
  const routine = routines.find(({ id }) => id === routineId);
  if (!routine) throw new Error("Routine not found");
  assertRoutine(routine);
  return routines.filter(({ id }) => id !== routineId);
}

export function routineView(routine: Routine, today: string): Routine & { nextDue: string; status: DueStatus; dueContext: string | null; latestCompletion: string | null; completionHistory: readonly string[] } {
  const nextDue = nextDueDate(routine);
  const status = dueStatus(routine, today);
  return {
    ...routine,
    nextDue,
    status,
    dueContext: status === "due" ? (nextDue === today ? "Due today" : `Due since ${nextDue}`) : null,
    latestCompletion: routine.completions.length ? latestCompletion(routine) : null,
    completionHistory: [...routine.completions].sort().reverse()
  };
}

export function routineViews(routines: readonly Routine[], today: string): ReturnType<typeof routineView>[] {
  return routines.map((routine) => routineView(routine, today)).sort((left, right) =>
    left.nextDue.localeCompare(right.nextDue) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
  );
}
