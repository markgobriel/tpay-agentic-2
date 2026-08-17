# Harness evolution

| Date | Evidence | Safeguard added | Enforced by |
| --- | --- | --- | --- |
| 2026-08-17 | Initial harness approval | Explicit approval gate, validation, browser evidence, read-only verification, and immutable audit history | `AGENTS.md`, docs, backlog and controller state |
| 2026-08-17 | HR-001 verifier found the boundary check passed with no domain source and had no negative proof; follow-up verifier found it also accepted a missing/empty domain directory | Require at least one domain source module; reject imports from web/server/storage; prove both rejection paths with disposable fixtures | `scripts/architecture-check.mjs`, `tests/architecture.test.mjs` |
