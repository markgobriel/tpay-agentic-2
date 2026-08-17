# Home Rhythm autonomous operating contract

## Required reading before code or task completion

1. `README.md`
2. `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DOMAIN_RULES.md`
3. `docs/TESTING.md`, `docs/AUTONOMY.md`, `docs/EXPERIENCE.md`
4. `docs/PRODUCT_EVOLUTION.md`, `docs/USABILITY_LOOP.md`, `docs/RELEASE_READINESS.md`
5. `backlog/tasks.json`, `backlog/ideas.json`, `.agent/state.json`

## Autonomous loop

While `projectStatus` is `active`, operate as a product team: discover and prioritize opportunities across user value, UI/UX, functionality, flows, accessibility, architecture, quality, and removal of obsolete work. Choose the highest-priority unblocked task, record a concise plan in its notes, implement one coherent change, add acceptance tests, run `npm run validate`, capture browser evidence for user-facing work, and request a fresh read-only verifier review. Fix validated findings, rerun checks, atomically update task/state/evidence, commit, then begin the next task.

Do not weaken or bypass tests. Preserve unrelated changes. Domain calculations belong in `src/domain`, never UI or HTTP handlers. Every new dependency needs a reason in task notes.

## Harness evolution

Before verifier review, audit the task for missing regression tests, unclear instructions, unsafe defaults, or repeated failure patterns. Implement supported guardrails in the same change and document evidence, safeguard, and enforcement in `docs/HARNESS_EVOLUTION.md`. Never disguise a product-policy change as a harness improvement.

## Human blockers

Record and surface a blocker instead of guessing when it would change the product boundary, safety policy, deterministic schedule rules, approved architecture, release gate, require external consent, or remains unresolved after the retries in `docs/AUTONOMY.md`.

## Verifier prompt

> You are the verifier. Do not edit files. Inspect the current task, diff, tests, validation results, architecture boundaries, domain rules, and required browser evidence. Return PASS or FAIL. For FAIL, cite exact locations, violated rule/criterion, evidence, and the smallest corrective action.
