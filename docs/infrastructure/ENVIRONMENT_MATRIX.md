# Thinkway Environment Matrix

**Phase 0.2 ? Infrastructure & Observability**  
**Last updated:** Jul 2026

---

## Environment overview

| Dimension | Local (dev) | Staging | Production |
|-----------|-------------|---------|------------|
| **App host** | `localhost:3000` | Vercel Preview / staging project | Vercel Production |
| **THINKWAY_ENV** | `local` | `staging` | `production` |
| **VERCEL_ENV** | ? | `preview` or `staging` | `production` |
| **Supabase project** | thinkway-dev (`hsxrewjcbvmbkqdlzjhs`) | Dedicated staging project (recommended) | Dedicated prod project |
| **Redis** | `redis://127.0.0.1:6379` (local) | Managed Redis (Upstash/ElastiCache) | Managed Redis (HA) |
| **Storage** | Supabase Storage (dev buckets) | Staging buckets | Production buckets |
| **Discovery worker** | Local process / Docker | Dedicated VM or container | Dedicated VM or container |
| **Structured logs** | Human-readable (default) | JSON (`STRUCTURED_LOGS=1`) | JSON (`STRUCTURED_LOGS=1`) |
| **Sentry** | Optional / disabled | Enabled | Enabled |
| **Health probes** | `/api/health`, `/api/ready`, `/api/version` | Same | Same + external uptime |

---

## Supabase

| Variable | Dev | Staging | Prod | Notes |
|----------|-----|---------|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Dev project URL | Staging URL | Prod URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dev anon key | Staging anon key | Prod anon key | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev service key | Staging service key | Prod service key | **Secret** ? server/cron only |

**Rule:** Never point production Vercel env at the dev Supabase project. Verify with `/api/version` ? `supabaseAligned`.

---

## Redis

| Variable | Dev | Staging | Prod | Notes |
|----------|-----|---------|------|-------|
| `REDIS_URL` | `redis://127.0.0.1:6379` | Staging Redis URL | Prod Redis URL | Required for queues + worker heartbeat |

Used by BullMQ discovery worker queues, campaign performance queues, and worker heartbeat key `thinkway:worker:discovery:heartbeat`.

---

## Storage (Supabase)

| Bucket | Purpose |
|--------|---------|
| `campaign-publication-media` | Publication screenshots / media |

Readiness probe lists this bucket via service role.

---

## Observability variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `THINKWAY_ENV` | No | `VERCEL_ENV` or `NODE_ENV` | Canonical environment label in logs |
| `STRUCTURED_LOGS` | No | `1` in production | Force JSON structured logging |
| `LOG_LEVEL` | No | ? | Set `debug` for verbose server logs |
| `LOG_PERF` | No | ? | Enable performance logs in production |
| `SENTRY_DSN` | No | ? | Error reporting (no-op when unset) |
| `SENTRY_ENVIRONMENT` | No | `THINKWAY_ENV` | Sentry environment tag |
| `DISCOVERY_METRICS` | No | auto in prod | Structured discovery latency logs |
| `AI_SEARCH_TRACE` | No | `1` in dev | Console search-trace (dev/debug) |

---

## Cron and secrets

| Variable | Dev | Staging | Prod |
|----------|-----|---------|------|
| `CRON_SECRET` | Optional (dev bypass) | Required | Required |

Cron routes: `/api/cron/publication-metrics`, `/api/cron/campaign-performance-monitor`

---

## Discovery worker env

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_URL` | Yes | Same project as app |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role |
| `REDIS_URL` | Yes | Same Redis as app |
| `OPENAI_API_KEY` | Optional | Enrichment/classification |

Worker reports version + git SHA on startup and writes heartbeat every 30s.

---

## Health endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health` | Public | Liveness |
| `GET /api/ready` | Public | Readiness (DB, Redis, storage, worker) |
| `GET /api/version` | Public | Version, git SHA, environment |
| `GET /api/admin/queues` | `operations.read` | BullMQ queue stats |
| `GET /api/build-info` | Public | Legacy deploy verification |

---

## Cross-references

- `docs/infrastructure/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `docs/infrastructure/SECRETS_CHECKLIST.md`
- `docs/infrastructure/WORKER_OPERATIONS.md`
