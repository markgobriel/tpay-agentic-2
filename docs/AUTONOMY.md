# Autonomy

The controller operates without routine approval while state is `active`. It logs each task plan, validation result, verifier verdict, and commit.

On a failure, diagnose and retry using a distinct reasonable strategy. After three reproducible failed strategies, or when a human-only decision is needed, record a `BLOCKED` state with commands, output summary, and exact required decision. Do not claim release completion without all release-readiness evidence.
