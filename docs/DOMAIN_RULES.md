# Domain rules

- A routine has a name, area, schedule, active state, and immutable completion events.
- Supported schedules are daily, weekly, monthly, and a positive custom interval in calendar days.
- Due status is derived from the schedule and completion history; it is never persisted as mutable truth.
- A completion is recorded against the local calendar date supplied by the application boundary.
- Editing a schedule changes future calculations only; historical completions remain unchanged.
- A paused routine is not due. Resuming preserves its existing schedule.
- The product must not label work as safe, urgent, hazardous, or professionally recommended.
