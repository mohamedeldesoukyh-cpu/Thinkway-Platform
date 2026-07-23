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
| `Cannot find module …/dist/index.js` | Stale start command. Production uses `node --import tsx src/index.ts` via `npm run discovery:worker`. Rebuild from repo root Dockerfile (or ensure root prod install includes `tsx`). Do **not** expect a `tsc` `dist/` emit — worker imports monorepo `@/*`. |
| `tsx: not found` | Host ran `tsx` as a shell binary without worker `node_modules/.bin`. Prefer Dockerfile build, or redeploy with root dependency `tsx` + `node --import tsx` entry (no PATH binary required). |
| `worker.alive: false` | Process running, Redis reachable, heartbeat key |
| Backlog growing | `/api/admin/queues` failed/waiting counts |
| Enrichment off | `DISABLE_CREATOR_ENRICHMENT`, enrichment flags |
| Auto enrich/acquire off (runaway brake) | `DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION` (default **true**): DB-only browse, no coverage/AI acquisition, legacy discovery-enrich scheduler paused; manual refresh still allowed. Set `false` to re-enable automatic paths. Blocks log as `[operational-safety] blocked …` |
| Apify budget fail-closed | `costProtection.maxRequestsPerDay` / `maxCreditsPerDay` must both be **> 0** (CCC or `DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY` / `DISCOVERY_APIFY_MAX_CREDITS_PER_DAY`). `0`/unset rejects all Apify acquisition. Logs: `[apify-budget] rejected` |
