# Home Rhythm

Home Rhythm is a private household-routine planner. It helps one household keep a calm, clear view of recurring upkeep without offering safety-critical repair or emergency advice.

## Autonomous operation

The harness is active. Read `AGENTS.md` before changing code. Run `npm run status` for the current controller state and `npm run validate` before completing a task.

For a readable live summary of the controller, run `npm run activity -- --follow`. Use `npm run activity` once for the most recent plans, changes, and checks.

## Product boundary

- Single household; no authentication or third-party accounts
- User-authored rooms and routine tasks
- Deterministic schedules, a Today view, completion history, and pause/resume
- No hazardous instructions, emergency guidance, purchases, or external-device control
