# Production Railway Worker — Implementation Plan (Planning Only)

**Date:** 2026-07-26  
**Status:** Planning — **no infrastructure changes in this document**  
**Constraint:** Existing Development worker (`Thinkway-Platform`) remains unchanged until/unless renamed as a non-breaking label change during execution.

---

## Executive recommendation

| Decision | Recommendation |
|---|---|
| Architecture | **One Railway project (`zealous-magic`), two services** |
| Dev service | Rename (label only) → `Thinkway-Platform-Dev` · branch `develop` · Dev Supabase · Dev Upstash Redis |
| Prod service | **New** → `Thinkway-Platform-Production` · branch `main` · Prod Supabase · **same Redis as Vercel Production** |
| Existing Railway Redis (`Redis` service) | Candidate for Production queue broker — **must verify host matches Vercel Production `REDIS_URL` before first Prod worker deploy** |

Do **not** point a second worker at Development Redis/Supabase. Do **not** run two consumers on the same Redis with the same queues unless intentionally scaled (see §6).

---

## 1. Railway architecture

### Target

```text
Railway project: zealous-magic (existing)
├── Thinkway-Platform-Dev          (existing service, rename only)
│     Git: mohamedeldesoukyh-cpu/Thinkway-Platform @ develop
│     Supabase: hsxrewjcbvmbkqdlzjhs
│     Redis:    saved-opossum-86561.upstash.io  (Vercel Preview Upstash)
│
├── Thinkway-Platform-Production   (NEW service)
│     Git: mohamedeldesoukyh-cpu/Thinkway-Platform @ main
│     Supabase: ienowhwfyxoqtzbgltno
│     Redis:    <exact host of Vercel Production REDIS_URL>
│
└── Redis                          (existing redis:8.2.1 + volume)
      Likely Production broker if Vercel Prod REDIS_URL = REDIS_PUBLIC_URL
      (sakura.proxy.rlwy.net) — VERIFY before cutover
```

### Same project vs second project

| Option | Pros | Cons |
|---|---|---|
| **A. Same project, second service (recommended)** | Shared Dockerfile/`railway.toml`; existing Redis + volume already in project; lower ops surface; Dev already isolated on Upstash | Mis-set env on wrong service is possible — mitigate with assert vars + checklist |
| B. Second Railway project for Production | Harder accidental cross-link; separate billing alerts | Duplicate Redis/networking; more login/project drift; still must wire Vercel Prod Redis correctly |

**Safest practical choice: Option A**, because:

1. Development is already on a **different Redis** (Upstash) — no shared broker with Production.
2. Production Vercel already has a `REDIS_URL`; the Production worker **must** join that broker, not create a parallel one.
3. Blast radius is controlled by **service-level env isolation** + startup asserts (`EXPECTED_SUPABASE_PROJECT_REF`, Redis host allow-list), not by project boundaries alone.

Use Option B only if org policy requires a separate Production Railway account/project for compliance.

### Naming / branch policy

| Service | Railway env name | Git branch | Auto-deploy |
|---|---|---|---|
| `Thinkway-Platform-Dev` | Keep or rename env label to `development` when convenient | `develop` | Yes |
| `Thinkway-Platform-Production` | Prefer Railway env `production` (or dedicated `production` env) | `main` | **Align with Vercel governance** — prefer manual deploy / promote, or require approval marker; do not silently ship Prod worker from every `main` push without process |

> Note: Vercel Production Git auto-deploy from `main` is disabled. Railway should not become an accidental Production release path. Prefer: deploy Production worker only after explicit `railway up` / dashboard Deploy from approved SHA, or gate `main` triggers.

---

## 2. Environment variables (Production worker)

Values are **not** listed here. Sources: Production Supabase API keys, Vercel Production env, Railway Redis public URL (if verified).

### Production-only (must differ from Dev)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | `https://ienowhwfyxoqtzbgltno.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production anon/publishable (if worker code paths need it) |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service role JWT (`ref=ienowhwfyxoqtzbgltno`) |
| `REDIS_URL` | **Identical** to Vercel Production `REDIS_URL` |
| `THINKWAY_ENV` | `production` |
| `NEXT_PUBLIC_THINKWAY_ENV` | `production` |
| `EXPECTED_SUPABASE_PROJECT_REF` | `ienowhwfyxoqtzbgltno` (fail closed if mismatch) |
| `CRON_SECRET` | Same as Vercel Production (if any worker path validates cron-shaped calls) |

### Shared (same logical integrations; still copy Prod-scoped secrets)

| Variable | Purpose |
|---|---|
| `APIFY_TOKEN` | Metrics / screenshots / enrichment actors |
| `APIFY_INSTAGRAM_ACTOR_ID` | Default `apify/instagram-scraper` if unset |
| `APIFY_TIKTOK_ACTOR_ID` | TikTok actor |
| `APIFY_YOUTUBE_ACTOR_ID` | YouTube actor |
| `OPENAI_API_KEY` | Import/AI paths that call OpenAI from worker |
| `META_GRAPH_ACCESS_TOKEN` | Meta metrics (if used) |
| `YOUTUBE_API_KEY` | YouTube metrics (if used) |
| `BRIGHTDATA_API_KEY` | Proxy/scrape (if used) |

### Optional

| Variable | Purpose | Default / note |
|---|---|---|
| `DISCOVERY_HEADLESS` | Playwright headless | `true` |
| `DISCOVERY_MIN_DELAY_MS` / `DISCOVERY_MAX_DELAY_MS` | Crawl pacing | 2000 / 8000 |
| `DISCOVERY_PROXY_URLS` | Comma-separated proxies | empty |
| `DISCOVERY_USER_AGENT` | Crawl UA | Thinkway default |
| `BATCH_PROFILE_ACQUISITION_*` | Batch size / retries / timeouts | code defaults |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` | Error reporting | recommended `production` |
| `GIT_SHA` / Railway-provided commit meta | Heartbeat / logs | auto |

### Feature flags (Production-safe defaults)

| Variable | Recommended Production value | Effect |
|---|---|---|
| `DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION` | `true` | Blocks auto discovery refresh/acquisition; **manual** refresh still allowed |
| `DISABLE_CREATOR_ENRICHMENT` | unset / `false` | Master kill — leave off unless emergency |
| `ALLOW_MANUAL_ENRICHMENT` | `true` | Manual Discovery refresh |
| `AUTO_CREATOR_ENRICHMENT` | `false` | No automatic enrichment storms |
| `AUTO_IMPORT_ENRICHMENT` | `false` | Import ≠ auto enrich |
| `ALLOW_BULK_ENRICHMENT` | `true` or policy-driven | Bulk refresh |
| `METRICS_PLAYWRIGHT_ENABLED` | `true` if Prod needs Playwright fallback | Metrics/screenshots |
| `CREATOR_INTELLIGENCE_MODE` | `shadow` or `on` per Prod product decision | CI ranking behaviour |
| `DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY` | Prod budget (e.g. `50` or higher) | Fail-closed if `0` for Apify acquisition |
| `DISCOVERY_APIFY_MAX_CREDITS_PER_DAY` | Prod budget | Same |
| `ALLOW_AVATAR_REFRESH` / `ALLOW_METRICS_REFRESH` / `ALLOW_PROFILE_REFRESH` / `ALLOW_AUDIENCE_REFRESH` / `ALLOW_CATEGORY_REFRESH` | default allow unless locking down | Scope gates |

### Hard asserts (implement at deploy time)

Before marking Production worker live:

1. `EXPECTED_SUPABASE_PROJECT_REF === ienowhwfyxoqtzbgltno`
2. Supabase URL host contains `ienowhwfyxoqtzbgltno`
3. Service-role JWT `ref` claim === `ienowhwfyxoqtzbgltno`
4. Redis host === Vercel Production Redis host (redacted compare)
5. Redis host **≠** `saved-opossum-86561.upstash.io` (Dev)
6. Redis host **≠** localhost

---

## 3. Redis

### Target instance

**The Production worker must use the exact same Redis instance as the Production Vercel app** (`REDIS_URL` on Vercel → Production).

| Surface | Current Redis (as of 2026-07-26) |
|---|---|
| Vercel Preview / `develop` | Upstash `saved-opossum-86561.upstash.io` |
| Vercel Production | `REDIS_URL` present (**sensitive** — host not decryptable via API in this session) |
| Railway Dev worker | Upstash Dev (aligned Option A) |
| Railway `Redis` service | Internal `redis.railway.internal` · Public `sakura.proxy.rlwy.net` |

### Verification steps (execution phase — do not skip)

1. In Vercel Dashboard → Project → Settings → Environment Variables → Production `REDIS_URL` → reveal host (or `vercel env pull` with an authorized operator session that can read sensitive values).
2. Compare host:port to Railway `Redis` → `REDIS_PUBLIC_URL` (`sakura.proxy.rlwy.net:…`).
3. **If they match:** set Production worker `REDIS_URL` to that same public URL (Vercel cannot use `*.railway.internal`).
4. **If they differ:** do **not** invent a second broker. Point the worker at whatever host Vercel Production already uses (or deliberately migrate both Vercel + worker together in a separate change).
5. Confirm Dev worker remains on Upstash only.

BullMQ requires **one shared Redis per environment** between app (producer) and worker (consumer).

---

## 4. Queue verification

All queues below are consumed by `services/discovery-worker` (except notes). Producers are primarily the **Next.js app on Vercel** (server actions / API / crons) using `REDIS_URL`.

| Queue | Producer(s) | Consumer | Primary DB touched | Idempotent? | Retry |
|---|---|---|---|---|---|
| `publication-metrics` | App enqueue; `publication-metrics-scheduler`; Vercel cron may enqueue | Metrics worker (concurrency 4) | `campaign_publications`, metrics tables | **Mostly** — keyed by publication; re-run refreshes metrics | Scheduler enqueue: 3 attempts, exp backoff 5s; retention `removeOnComplete:1000` / `removeOnFail:100` |
| `publication-metrics-scheduler` | Repeatable job `publication-metrics-hourly-scan` | Scheduler worker | Reads publications; enqueues metrics; stuck recovery | Yes (scan) | Repeatable; `removeOnComplete:10` |
| `publication-screenshot` | Metrics collector / performance actions | Screenshot worker | Publication media / storage | **Mostly** — re-capture ok | 3 attempts, exp 5s (scheduler path) |
| `publication-screenshot-scheduler` | Repeatable quarter-hourly scan | Scheduler worker | Reads pubs; enqueues screenshots | Yes | Repeatable |
| `creator-import` | Import UI / resume / recover-stuck | Import worker | `creator_import_*` / influencers | **Yes** — stable `jobId: creator-import-{fileId}` | 3 attempts, exp 5s, long lock |
| `creator-import-chunk` | Import flow producer | Chunk worker | Import chunks / creators | **Mostly** — chunk jobIds include index | 3 attempts, exp 5s |
| `creator-enrichment` | Enrichment orchestrator / manual refresh | Enrichment worker (if enabled) | DNA / enrichment status | Partial — status machine + recover-stuck | Worker-specific; DLQ on hard fail |
| `creator-enrichment-dlq` | Enrichment worker | Ops inspection (not auto-replay) | N/A | N/A | Manual |
| `discovery-run` | Discovery / coverage backfill | Discovery worker | `discovery_jobs`, profiles | Partial — job tracker by `jobId` | Via `CAMPAIGN_PERFORMANCE_JOB_OPTIONS` retention |
| `discovery-enrich` | Refresh worker / enrichment enqueue | Enrichment worker | Enrichment tables | Partial | Retention defaults |
| `discovery-refresh` | Scheduler (if auto not disabled) | Refresh worker | Triggers enrich jobs | Scan-like | `removeOnComplete:20` |
| `discovery-scheduler` | Repeatable `0 */6 * * *` (blocked if auto-disable) | Scheduler | Enqueues refresh | Yes | Skipped when `DISABLE_AUTOMATIC_…=true` |
| `enterprise-acquisition` | Coverage / enterprise enqueue | Enterprise acquisition worker | `discovery_jobs` / acquisition | Partial — budget + job row | Budget fail-closed |
| `batch-profile-acquisition` | Batch acquisition service | Batch worker | Profiles / acquisition audit | Partial | Policy retries (env) |
| `creator-import-enrich` | Listed in constants | **No dedicated starter in `index.ts`** | — | — | Confirm dead-letter / unused at execution |
| `performance-report` | App inventory only | **Not consumed by discovery-worker** | Reports via app | N/A | Out of scope for this worker |

With `DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION=true` (recommended Prod default), schedulers for **legacy discovery refresh** no-op; **publication metrics/screenshot schedulers still run** (required for Production users).

---

## 5. Deployment procedure

### Preconditions

- [ ] Development worker verified on Dev Supabase + Upstash; left running.
- [ ] Vercel Production Redis host identified and recorded (redacted).
- [ ] Production Supabase service role + URL available to operator (not committed).
- [ ] Approved Production SHA on `main` (or pin deploy to SHA).
- [ ] No second consumer already on Production Redis (confirm `railway service list` + Redis `CLIENT LIST` / BullMQ workers if available).

### Sequence

1. **Rename (optional, non-breaking):** Railway service `Thinkway-Platform` → `Thinkway-Platform-Dev`. Do not change its env/Redis/branch.
2. **Create service:** `Thinkway-Platform-Production` in project `zealous-magic`.
   - Root `/`, Dockerfile from `railway.toml`, start `npm run discovery:worker`.
   - Source: repo `mohamedeldesoukyh-cpu/Thinkway-Platform`, branch **`main`** (or deploy from SHA without auto-trigger).
3. **Configure env vars** (all §2 Production-only + secrets + flags) on the **new service only**. Use `--skip-deploys` until complete.
4. **Preflight script (recommended before first boot):** print redacted ref/host only; abort if Dev refs/hosts detected.
5. **First deployment:** deploy approved SHA. Watch build logs for missing env / Playwright / Dockerfile errors.
6. **Health verification:**
   - Logs: `environment="production"` (or `THINKWAY_ENV=production`), `ready — queues: …`
   - Heartbeat key in **Production Redis**: `thinkway:worker:discovery:heartbeat` with Prod git SHA / env.
   - Ops Center / `/api/ready` on **app.thinkwaymedia.com** shows worker alive (once app shares Prod Redis).
7. **Queue verification:** BullMQ meta for Prod queues shows **1** worker per queue (not 0, not 2). Waiting jobs drain.
8. **Smoke tests (Production data, low blast radius):**
   - Trigger metrics refresh for **one** known publication → `publication-metrics` completes.
   - Confirm screenshot enqueue/complete or intentional skip.
   - Run a **small** creator import fixture (or resume a safe stuck import) → `creator-import` / chunk complete.
   - Confirm rows written only in Production Supabase (`ienowhwfyxoqtzbgltno`).
9. **Negative checks:** Dev Upstash shows no new Prod traffic; Dev worker logs unchanged; Prod worker logs never mention `hsxrewjcbvmbkqdlzjhs`.

### Rollback

| Failure | Action |
|---|---|
| Wrong Supabase/Redis detected at boot | Stop/remove Production service deploy; fix env; do not restart |
| Duplicate processing | Scale Production service to 0 replicas immediately; confirm Dev still on Upstash |
| Bad release | Redeploy previous known-good SHA on Production service only |
| Data damage suspected | Stop worker; freeze enqueues (maintenance); use DB backup/PITR-or-clone drill playbook — **do not** point worker at Dev |

Rollback does **not** change the Dev worker.

---

## 6. Risk assessment

| Risk | Severity | Prevention |
|---|---|---|
| **Downtime** | Low for app HTTP; **medium** for async features until worker live | Deploy worker without taking Dev down; smoke before announcing |
| **Duplicate worker** (two consumers, one Redis) | High | Only one Production service; Dev stays on Upstash; verify worker count = 1 |
| **Duplicate queue processing** | High | Same as above; BullMQ jobIds for imports reduce double-prepare; metrics refresh is re-entrant but wastes Apify $ |
| **Data corruption** | High if Dev secrets used | `EXPECTED_SUPABASE_PROJECT_REF` + JWT ref assert; checklist forbids Dev URLs |
| **Race conditions** (two schedulers) | Medium | Never run two schedulers on same Redis; import `jobId` stability; stuck-recovery is single-scheduler design |
| **Accidental Production deploy from every `main` push** | Medium | Disable or gate Railway auto-deploy; match Vercel approval culture |
| **Apify cost runaway** | Medium | Keep auto-acquisition disabled; set daily Apify caps > 0 only as intended |
| **Redis mismatch** (app enqueues A, worker on B) | High | Host equality check with Vercel Production before go-live |

---

## 7. Validation checklist (go-live gate)

### Worker online

- [ ] Railway `Thinkway-Platform-Production` status SUCCESS, 1 replica RUNNING  
- [ ] Logs show discovery engine ready and queue list  
- [ ] Heartbeat key present on **Production** Redis, age &lt; 90s  

### Queues registered

- [ ] Consumers attached: `publication-metrics`, `publication-metrics-scheduler`, `publication-screenshot`, `publication-screenshot-scheduler`, `creator-import`, `creator-import-chunk`, plus Discovery queues as enabled  
- [ ] Exactly **one** worker instance per queue on Production Redis  

### Production Redis connected

- [ ] Worker `REDIS_URL` host === Vercel Production `REDIS_URL` host  
- [ ] Host ≠ Upstash Dev (`saved-opossum-86561.upstash.io`)  
- [ ] Host ≠ localhost  

### Production Supabase connected

- [ ] URL ref = `ienowhwfyxoqtzbgltno`  
- [ ] Service role JWT `ref` = `ienowhwfyxoqtzbgltno`  
- [ ] `EXPECTED_SUPABASE_PROJECT_REF` = `ienowhwfyxoqtzbgltno`  

### Functional smokes

- [ ] **Publication metrics** processed for a test publication (JOB_COMPLETED)  
- [ ] **Screenshots** processed or cleanly skipped with expected reason  
- [ ] **Creator import** prepare/chunk path succeeds for a controlled file  

### Isolation

- [ ] Dev worker still on `develop` + Dev Supabase + Upstash  
- [ ] No Production worker logs referencing Dev project ref  
- [ ] No Dev Redis traffic attributed to Production jobs  
- [ ] Railway Dev service env untouched  

---

## Out of scope for this plan

- Enabling Supabase PITR (separate residual from P0-5)  
- Changing Vercel Production Redis provider  
- Scaling to N Production replicas  
- Implementing code-level startup asserts (recommended before/with execution)  

---

## Approval gate

No Railway/Vercel/Supabase changes are authorized by this document alone. Proceed to execution only after explicit approval of:

1. Option A (same project, second service), and  
2. Confirmed Production Redis host identity, and  
3. Feature-flag defaults in §2.
