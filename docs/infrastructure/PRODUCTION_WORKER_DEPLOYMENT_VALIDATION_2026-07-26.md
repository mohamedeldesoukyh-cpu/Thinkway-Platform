# Production Railway Worker — Deployment Validation

**Date:** 2026-07-26  
**Plan:** `docs/infrastructure/PRODUCTION_WORKER_PROVISIONING_PLAN.md`  
**Result:** **PASS**

---

## Summary

Provisioned a dedicated Production discovery worker in Railway project `zealous-magic` without changing the Development worker’s Supabase, Redis, branch, or env role.

| Surface | Service | Git | Supabase | Redis | `THINKWAY_ENV` | Status |
|---|---|---|---|---|---|---|
| Development | `Thinkway-Platform` | `develop` | `hsxrewjcbvmbkqdlzjhs` | `saved-opossum-86561.upstash.io` | `development` | ● Online (unchanged) |
| Production | `Thinkway-Platform-Production` (new) | `main` @ `34ca1bc` | `ienowhwfyxoqtzbgltno` | `sakura.proxy.rlwy.net` | `production` | ● Online |
| Broker | `Redis` (`redis:8.2.1`) | — | — | public `sakura.proxy.rlwy.net` | — | ● Online |

---

## Preconditions completed

1. **Fail-fast guards** shipped on `main` (`34ca1bc`) and `develop` (`7010018`): `services/discovery-worker/src/runtime-guards.ts` aborts before BullMQ consumers if Production Supabase / Redis / env bindings are wrong.
2. **Production Redis identity:** Railway `REDIS_PUBLIC_URL` host = `sakura.proxy.rlwy.net`. Vercel Production `REDIS_URL` was empty/unreadable via pull; operator **overrode** Vercel Production `REDIS_URL` to the Railway public URL so app + worker share one broker.
3. Development worker left on Dev Upstash + Dev Supabase.

---

## Deployment steps executed

1. Set Vercel Production `REDIS_URL` → Railway `REDIS_PUBLIC_URL` (`sakura.proxy.rlwy.net`).
2. Created Railway service `Thinkway-Platform-Production` (empty → env → connect `main`).
3. Set Production-only env (Supabase Prod URL + service role, Redis, `THINKWAY_ENV=production`, `EXPECTED_SUPABASE_PROJECT_REF`, `EXPECTED_REDIS_HOST`, feature flags, Apify/OpenAI).
4. Set `deploy.startCommand` = `npm run discovery:worker` (GraphQL `serviceInstanceUpdate`).
5. Deployed `main` @ `34ca1bc` (`redeploy --from-source`).

Optional rename `Thinkway-Platform` → `Thinkway-Platform-Dev` was **not** applied (non-blocking label only).

---

## Runtime verification

### Boot logs (Production)

```text
[discovery-worker] Production runtime guards OK (supabase=ienowhwfyxoqtzbgltno, redis=sakura.proxy.rlwy.net)
[discovery-worker] DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION=true — …
[discovery-worker] ready — queues: discovery, enrichment, refresh, scheduler, publication-metrics, …
environment="production"
```

### Heartbeats (isolated brokers)

| Redis | Heartbeat env | Present |
|---|---|---|
| `sakura.proxy.rlwy.net` | `production` | Yes (`thinkway:worker:discovery:heartbeat`) |
| `saved-opossum-86561.upstash.io` | `development` | Yes (Dev worker only) |

### Isolation checks

- Prod worker Supabase ref ≠ Dev (`ienowhwfyxoqtzbgltno` vs `hsxrewjcbvmbkqdlzjhs`)
- Prod Redis host ≠ Dev Upstash
- Dev service still ● Online with prior Dev bindings
- Automatic enrichment/acquisition disabled on Production

---

## Residual notes

| Item | Severity | Note |
|---|---|---|
| Vercel `REDIS_URL` not readable via `env pull` | Low | Sensitive; CLI override succeeded. Confirm in Vercel Dashboard if needed. Redeploy Production **app** when ready so runtime picks up Redis (Git auto-deploy disabled). |
| `CRON_SECRET` not set on Prod worker | Low | Not present in Vercel Production pull; set when available if worker paths require it. |
| Builder `RAILPACK` (same as Dev) | Info | Matches existing Dev worker; start command set explicitly. |
| Railway env still named `production` for Dev service | Info | Role is Development via env vars; rename env label later if desired. |
| Smoke enqueue (metrics/import) | Follow-up | Worker ready; optional low-blast-radius smoke on live Prod data. |

---

## Rollback

Scale/stop `Thinkway-Platform-Production` only. Do **not** alter `Thinkway-Platform` (Dev).
