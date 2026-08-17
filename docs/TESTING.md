# Testing

`npm run validate` is required for every completed task. It runs formatting, TypeScript checks, unit tests, API tests, and an architecture-boundary test.

Domain tests must cover calendar edges: month boundaries, leap-day behavior, stale/overdue work, pause/resume, and schedule edits. User-facing work additionally needs a real-browser flow at desktop and mobile widths, keyboard interaction, visible-value verification, and console/network inspection.
