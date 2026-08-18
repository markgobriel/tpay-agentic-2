# Autonomy

The standalone controller operates without routine approval while state is `active`. Start it with `npm run autonomous`; it launches a Codex CLI worker for one coherent task at a time, persists JSONL events in `.agent/logs/controller.ndjson`, and reassesses the saved state between runs. Set `HOME_RHYTHM_MAX_AUTONOMOUS_RUNS` to a positive integer for a bounded run (the default continues until a terminal state). Set `HOME_RHYTHM_AGENT_BIN` only when the Codex executable has a different name or location. It runs Codex with `danger-full-access` by default because the product’s required preview and browser checks need loopback TCP; set `HOME_RHYTHM_AGENT_SANDBOX=workspace-write` only when those checks are not required. It logs each task plan, validation result, verifier verdict, and commit.

Use `npm run activity` for the recent human-readable controller timeline, or `npm run activity -- --follow` to watch only meaningful plans, edits, checks, and lifecycle events as they arrive.

The controller refuses to begin unless `projectStatus` is `active`. Three consecutive CLI failures set a durable `blocked` state with the log location rather than silently retrying forever. Each post-run validation result is saved in `lastControllerValidation`; a failure is explicitly repaired before the next product task and is never treated as success.

On a failure, diagnose and retry using a distinct reasonable strategy. After three reproducible failed strategies, or when a human-only decision is needed, record a `BLOCKED` state with commands, output summary, and exact required decision. Do not claim release completion without all release-readiness evidence.
