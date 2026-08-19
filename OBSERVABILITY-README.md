# Home Rhythm — Observability & Docker Setup

This document explains the observability environment added to Home Rhythm: what was built, why those choices were made, and how to run a trial (for example on a colleague's machine with Docker installed).

The main [README.md](README.md) covers the product. This file covers **Elastic APM, Docker, and the trial stack only**.

---

## Goal

Provide a ready-to-run environment so you can:

1. Run Home Rhythm in a container (or on the host)
2. Send API traces directly to **Elastic APM**
3. Inspect those traces in **Kibana**

No message queue, no extra infrastructure beyond Elastic and the app.

---

## What was added

| File | Purpose |
|------|---------|
| `docker-compose.yml` | One-command stack: app + Elasticsearch + Kibana + APM Server |
| `Dockerfile` | Builds the Node app image used by Compose |
| `scripts/start-apm.mjs` | Bootstraps `elastic-apm-node` when configured |
| `scripts/dev.mjs` | Loads APM bootstrap before starting the HTTP server |
| `.env.example` | Template for running the app against a local Elastic stack |
| `docs/OBSERVABILITY.md` | Short operational quick reference |
| `tests/observability.test.mjs` | Regression checks for APM wiring and Compose layout |
| `package.json` scripts | `observability:up`, `observability:stack`, `observability:down` |

**Dependency added:** `elastic-apm-node` (official Elastic APM agent for Node.js).

---

## Architecture choices

### 1. Elastic APM direct (no RabbitMQ)

Traces flow straight from the Node process to APM Server:

```text
Home Rhythm (Node)  →  APM Server (:8200)  →  Elasticsearch  →  Kibana
```

RabbitMQ was **not** included. It would only add a transport layer between producers and Elasticsearch. For a first trial with one app and one agent process, direct APM is simpler and matches the "Elasticsearch APM direct" direction.

### 2. APM is opt-in via environment variables

APM starts **only** when `ELASTIC_APM_SERVER_URL` is set. Without it:

- `npm run dev` behaves as before
- No connection attempts to Elastic
- No impact on local development or CI

This keeps the harness and tests usable without Docker or Elastic running.

### 3. Docker Compose for the trial host

Docker is required **on the machine running the trial**, not necessarily on every developer laptop. Compose bundles:

- **Elasticsearch** — stores trace data
- **Kibana** — UI for viewing traces
- **APM Server** — ingest endpoint for the Node agent
- **app** — Home Rhythm built from the repo `Dockerfile`

Security is disabled on Elasticsearch for local trial simplicity (`xpack.security.enabled=false`). This is appropriate for a local demo only, not production.

### 4. App data vs observability data (separate storage)

| Data | Where it lives |
|------|----------------|
| Household routines | `data/routines.json` (mounted volume in Docker) |
| Traces / APM metrics | Elasticsearch (Docker volume `elasticsearch-data`) |

Elasticsearch does **not** replace the app's routine storage. It only holds observability data.

### 5. Vercel deployment unchanged

The hosted Vercel preview does not use this stack. Observability is for **local or Docker trials** only.

---

## Stack diagram

```text
┌─────────────────────────────────────────────────────────────┐
│  docker compose (trial host)                                │
│                                                             │
│  ┌──────────────┐    traces     ┌──────────────┐           │
│  │  app         │ ────────────► │  apm-server  │           │
│  │  :4173       │               │  :8200       │           │
│  └──────────────┘               └──────┬───────┘           │
│         │                              │                    │
│         │ reads/writes                 │ indexes           │
│         ▼                              ▼                    │
│  ┌──────────────┐               ┌──────────────┐           │
│  │  data/       │               │ elasticsearch│           │
│  │  routines.json│              │  :9200       │           │
│  └──────────────┘               └──────┬───────┘           │
│                                        │                    │
│                                        ▼                    │
│                                 ┌──────────────┐           │
│                                 │  kibana      │           │
│                                 │  :5601       │           │
│                                 └──────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

**Full stack (recommended for trial):**

- Docker Desktop or Docker Engine + Docker Compose v2
- ~4 GB free RAM (Elasticsearch is memory-hungry)
- Git clone of this repo

**Hybrid mode (Elastic in Docker, app on host):**

- Docker (for Elastic services only)
- Node.js/npm (same as normal Home Rhythm development)

You do **not** need Docker on your machine if someone else runs the trial stack and you only contribute code.

---

## How to run

### Option A — Full stack in Docker (recommended)

Run on the machine that has Docker (for example your colleague's computer):

```bash
git clone <repo-url>
cd home-rhythm
npm run observability:up
```

This runs `docker compose up --build`, which:

1. Pulls Elasticsearch, Kibana, and APM Server images
2. Builds the Home Rhythm app image
3. Starts all four services
4. Sets `ELASTIC_APM_SERVER_URL=http://apm-server:8200` inside the app container

**Verify the trial:**

1. Open **http://localhost:4173** — use the app (add a routine, mark complete, etc.)
2. Open **http://localhost:5601** — Kibana (first load may take ~1 minute)
3. Navigate to **Observability → APM → Services → home-rhythm**
4. Confirm HTTP transactions appear for `/api/routines` and related routes

**Stop everything:**

```bash
npm run observability:down
```

---

### Option B — Elastic in Docker, app on the host

Useful for debugging the app locally while still sending traces to Elastic.

**Terminal 1 — start Elastic services only:**

```bash
npm run observability:stack
```

**Terminal 2 — run the app with APM enabled:**

```bash
cp .env.example .env
npm install
npm run dev
```

The `.env` file sets `ELASTIC_APM_SERVER_URL=http://localhost:8200` so the host process reaches APM Server exposed by Docker.

---

### Option C — Point at a remote trial host

If Elastic runs on another machine and you can reach port 8200 (directly or via SSH tunnel):

```bash
export ELASTIC_APM_SERVER_URL=http://localhost:8200   # after SSH tunnel
export ELASTIC_APM_SERVICE_NAME=home-rhythm
npm run dev
```

Example tunnel:

```bash
ssh -L 8200:localhost:8200 user@trial-host
```

---

## Environment variables

| Variable | Required to enable APM | Default | Description |
|----------|------------------------|---------|-------------|
| `ELASTIC_APM_SERVER_URL` | Yes | — | APM Server ingest URL (e.g. `http://localhost:8200` or `http://apm-server:8200` in Compose) |
| `ELASTIC_APM_SERVICE_NAME` | No | `home-rhythm` | Service name shown in Kibana |
| `ELASTIC_APM_ENVIRONMENT` | No | `development` | Environment label on traces |
| `ELASTIC_APM_SECRET_TOKEN` | No | — | Only if APM Server authentication is enabled |
| `PORT` | No | `4173` | App HTTP port |
| `HOME_RHYTHM_DATA_FILE` | No | `data/routines.json` | Routine persistence path |

Copy `.env.example` to `.env` for local/hybrid runs. Do not commit `.env` (it is gitignored).

---

## npm scripts

| Script | Command | What it does |
|--------|---------|--------------|
| `observability:up` | `docker compose up --build` | Start full stack (app + Elastic) |
| `observability:stack` | `docker compose up elasticsearch kibana apm-server -d` | Start Elastic only, detached |
| `observability:down` | `docker compose down` | Stop and remove containers |

Normal development without observability:

```bash
npm run dev          # APM off unless ELASTIC_APM_SERVER_URL is set
npm run validate     # includes observability regression tests
```

---

## How APM is wired in code

1. **`scripts/start-apm.mjs`** — reads `ELASTIC_APM_SERVER_URL`; if set, calls `apm.start(...)` from `elastic-apm-node`.
2. **`scripts/dev.mjs`** — imports `./start-apm.mjs` **before** any server imports so the agent can patch Node's HTTP module.
3. **`docker-compose.yml`** — injects APM env vars into the `app` service so the container reports to `apm-server` on the Docker network.

The agent automatically creates spans for incoming HTTP requests handled by the Node `http` server created in `src/server/app.mjs`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Kibana won't load | Elasticsearch still starting | Wait 1–2 minutes; check `docker compose logs elasticsearch` |
| No traces in Kibana | APM not enabled | Confirm `ELASTIC_APM_SERVER_URL` is set in the app process/container |
| No traces in Kibana | No traffic yet | Use the app at :4173 to hit API routes |
| App container exits | Build or port conflict | Run `docker compose logs app`; ensure port 4173 is free |
| Hybrid mode: no traces | Wrong APM URL | Host app must use `http://localhost:8200`, not `http://apm-server:8200` |
| Out of memory | Elasticsearch default heap | Ensure the host has enough RAM; compose sets `-Xms512m -Xmx512m` |

---

## What is intentionally out of scope

- **RabbitMQ** — not used; direct APM ingest is sufficient for this trial
- **Agent/controller log shipping** — autonomous harness logs (`.agent/logs/controller.ndjson`) are not sent to Elastic in this setup; only the product API is traced
- **Production hardening** — no TLS, no Elastic security, no auth tokens (local trial only)
- **Hosted Vercel APM** — serverless preview is unchanged

These can be added later if the trial expands beyond API tracing.

---

## Quick checklist for a first demo

- [ ] Docker installed on trial machine
- [ ] `npm run observability:up` completes without errors
- [ ] http://localhost:4173 loads Home Rhythm
- [ ] Create or complete at least one routine
- [ ] http://localhost:5601 opens Kibana
- [ ] **Observability → APM → home-rhythm** shows transactions
- [ ] `npm run observability:down` stops the stack

---

## Related files

- [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) — condensed quick reference
- [README.md](README.md) — product overview and autonomous harness
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — app architecture (domain / server / web)
