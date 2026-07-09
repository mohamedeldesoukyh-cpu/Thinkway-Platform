# Worker Operations — Discovery Worker

**Service:** `services/discovery-worker`  
**Queues:** `lib/observability/discovery-queues.ts`

---

## Startup

```bash
npm run discovery:worker        # production mode
npm run discovery:worker:dev    # watch mode
```

On startup the worker logs version/git SHA, registers BullMQ workers, and starts heartbeat (30s interval, 120s TTL).

---

## Heartbeat

| Key | TTL | Payload fields |
|-----|-----|----------------|
| `thinkway:worker:discovery:heartbeat` | 120s | service, version, gitSha, environment, startedAt, lastBeat, queues |

Readiness: `/api/ready` → `worker.alive` (stale if age > 90s).

Manual check: `redis-cli GET thinkway:worker:discovery:heartbeat`

---

## Required environment

- `REDIS_URL` — BullMQ + heartbeat
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — job DB access

See `services/discovery-worker/src/config.ts` for optional keys.

---

## Monitoring

- `GET /api/admin/queues` — queue stats (requires `operations.read`)
- `GET /api/admin/campaign-performance/health` — performance pipeline health
- `GET /api/ready` — worker heartbeat status

---

## Graceful shutdown

Handles `SIGINT` / `SIGTERM`: closes workers, browser pool, exits.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| `worker.alive: false` | Process running, Redis reachable, heartbeat key |
| Backlog growing | `/api/admin/queues` failed/waiting counts |
| Enrichment off | `DISABLE_CREATOR_ENRICHMENT`, enrichment flags |
