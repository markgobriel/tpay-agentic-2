#!/bin/sh
set -eu

node scripts/status.mjs
printf '{"event":"controller_started","at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .agent/logs/controller.ndjson
printf '%s\n' "Controller state recorded. The active agent follows AGENTS.md and persists validation evidence before advancing."
