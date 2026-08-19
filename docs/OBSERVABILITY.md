# Observability quick reference

For the full setup guide — architecture decisions, file list, troubleshooting, and trial checklist — see **[OBSERVABILITY-README.md](../OBSERVABILITY-README.md)** at the repo root.

## Ports

| Service | Port |
|---------|------|
| Home Rhythm app | 4173 |
| APM Server | 8200 |
| Elasticsearch | 9200 |
| Kibana | 5601 |

## Commands

```bash
npm run observability:up      # full stack (app + Elastic)
npm run observability:stack   # Elastic only, detached
npm run observability:down    # stop all containers
```

## Verify traces

1. Use the app at http://localhost:4173
2. Open Kibana at http://localhost:5601
3. Go to **Observability → APM → home-rhythm**

APM is enabled only when `ELASTIC_APM_SERVER_URL` is set. See `.env.example`.
