export function asRoutineRepository(repository) {
  if (!repository || typeof repository.list !== "function" || typeof repository.replace !== "function") {
    throw new Error("Routine repository needs list and replace operations");
  }
  return repository;
}
