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

Set on the **Railway worker service** (Vercel does not inject these into the worker):

| Variable | Notes |
|----------|--------|
| `SUPABASE_URL` **or** `NEXT_PUBLIC_SUPABASE_URL` | Either works |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role JWT |
| `REDIS_URL` | Managed Redis (`rediss://…`). **Not** `localhost` |

Recommended Safe Mode (match Vercel Production when acquisition must stay off):

- `DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION=true`
- For **live Manual Refresh**, set positive daily caps (DB `costProtection` may be 0/0):
  - `DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY=500` (example)
  - `DISCOVERY_APIFY_MAX_CREDITS_PER_DAY=500` (example)
- `0` / unset caps **fail-close** Apify acquisition (intentional)

Template: `services/discovery-worker/.env.example`

**Dev Railway worker crash (Redis / log rate limits):** tracked separately as Dev infrastructure — `docs/infrastructure/BACKLOG_DEV_RAILWAY_WORKER_REDIS_LOG_RATE_LIMITS.md`. Do not classify as Apify Refresh product failure.

### Railway deploy (canonical)

1. Root Directory: `/`
2. Builder: Dockerfile (`railway.toml` → root `Dockerfile`)
3. Start: `npm run discovery:worker` (already set in `railway.toml`)
4. Copy variables from `.env.example` into the Railway service

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
| `Cannot find package 'playwright'` (or other worker-only deps) | Railway/Nixpacks installed **root** `package.json` only. Worker must build via `services/discovery-worker/Dockerfile` (see root `railway.toml`). Service Root Directory must be repo root `/` so the image can copy monorepo `@/*` sources and install worker deps (including Playwright browsers). |
| `worker.alive: false` | Process running, Redis reachable, heartbeat key |
| Backlog growing | `/api/admin/queues` failed/waiting counts |
| Enrichment off | `DISABLE_CREATOR_ENRICHMENT`, enrichment flags |
| Auto enrich/acquire off (runaway brake) | `DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION` (default **true**): DB-only browse, no coverage/AI acquisition, legacy discovery-enrich scheduler paused; manual refresh still allowed. Set `false` to re-enable automatic paths. Blocks log as `[operational-safety] blocked …` |
| Apify budget fail-closed | Caps must both be **> 0** (CCC or `DISCOVERY_APIFY_MAX_*`). Logs: `[apify-budget] rejected`. Worker must use service-role client (`lib/supabase/service-role-client.ts`), not `server-only` admin. |
| Dev worker Crashed / Railway log rate limit | Infra backlog `BACKLOG_DEV_RAILWAY_WORKER_REDIS_LOG_RATE_LIMITS.md` — not a Refresh product defect |
