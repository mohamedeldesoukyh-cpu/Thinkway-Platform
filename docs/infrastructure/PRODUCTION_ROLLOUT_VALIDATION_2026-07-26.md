# Production Rollout Validation — App + Worker + Queues

**Date:** 2026-07-26  
**Verdict:** **PASS**  
**Scope:** Redeploy Production Vercel app (pick up `REDIS_URL`), verify Production worker, smoke BullMQ paths, confirm Development isolation. No further infrastructure changes.

---

## 1. Production application redeploy

| Item | Value |
|---|---|
| Method | `vercel deploy --prod` from clean `origin/main` worktree @ `34ca1bc` |
| Deployment | `dpl_8bgG6TowpoPsB33CzgAszf9L2vnL` |
| URL | `https://thinkway-platform-89f6x413o-mohamedeldesoukyh-cpus-projects.vercel.app` |
| Promote / alias | `vercel promote` + `vercel alias set` → `https://app.thinkwaymedia.com` |
| Note | `github.autoAlias=false` required explicit alias of `app.thinkwaymedia.com` after deploy |

### Live app checks (`https://app.thinkwaymedia.com`)

| Check | Result |
|---|---|
| `/api/ready` | `200` `{ "status": "ok" }` |
| `/api/health` | `200` |
| `/api/version` | `environment=production`, `supabaseProjectRef=ienowhwfyxoqtzbgltno`, `supabaseAligned=true`, `productionReady=true` |

---

## 2. Production worker health (post-redeploy)

| Check | Result |
|---|---|
| Railway service | `Thinkway-Platform-Production` ● Online / `SUCCESS` |
| Fail-fast guards | Previously confirmed at boot: Prod Supabase + `sakura.proxy.rlwy.net` |
| Heartbeat | `thinkway:worker:discovery:heartbeat` on Prod Redis, `environment=production`, fresh TTL |
| Queues ready | 12 consumers including metrics, screenshot, creator-import |

Development worker `Thinkway-Platform` remained ● Online with `environment=development` heartbeat on Upstash.

---

## 3. Smoke tests

Jobs enqueued on **Production Redis only** (`sakura.proxy.rlwy.net`); results verified in **Production Supabase** (`ienowhwfyxoqtzbgltno`).

### 3.1 Publication metrics refresh

| Step | Result |
|---|---|
| Publication | `4b655132-d0e7-4a07-bdc2-338d185e0301` |
| Queue | `publication-metrics` job `417` |
| Terminal state | **completed** |
| Worker log | `JOB_COMPLETED` / TikTok path processed |
| Prod DB | `metrics_refresh_attempted_at=2026-07-26T05:04:45.666Z`, views/likes present |

### 3.2 Publication screenshot

| Step | Result |
|---|---|
| Queue | `publication-screenshot` jobs `417` / `418` |
| Terminal state | **completed** |
| Prod DB | `screenshot_url` + `thumbnail_url` present (`…/screenshot.jpg`, `…/thumbnail.jpg`) |

### 3.3 Small creator import

| Step | Result |
|---|---|
| Fixture | 1-row CSV `prod-smoke-one-row.csv` in `creator-imports` storage |
| Import file | `bb18aecd-0dee-4ef4-a136-9c84a37cfd2f` |
| Queue | `creator-import` → **completed** |
| Prod DB | `status=completed`, `total_creators=1`, `imported_creators=1` |

(Earlier no-storage enqueue correctly failed with `Import file has no storage path` — proves fail-closed validation; superseded by successful storage-backed smoke.)

---

## 4. Development isolation (negative checks)

| Check | Result |
|---|---|
| Smoke marker written to Prod Redis absent from Dev Upstash | **PASS** |
| Metrics job ID not present on Dev Redis | **PASS** |
| Import file `bb18aecd-…` exists on Prod; **null** on Dev Supabase | **PASS** |
| Dev worker heartbeat still `environment=development` | **PASS** |
| App `/api/version` Supabase ref is Production only | **PASS** |
| Dev worker Redis / Supabase / branch | Unchanged (Upstash + `hsxrewjcbvmbkqdlzjhs` + `develop`) |

No Development Redis host (`saved-opossum-86561.upstash.io`) or Development Supabase ref was used for Production smokes.

---

## 5. System matrix (final)

| Layer | Production binding | Status |
|---|---|---|
| Vercel app | `app.thinkwaymedia.com` → deploy `dpl_8bgG6TowpoPsB33CzgAszf9L2vnL` | OK |
| Supabase | `ienowhwfyxoqtzbgltno` | OK (version + smoke writes) |
| Redis | `sakura.proxy.rlwy.net` (shared app intent + worker) | OK |
| BullMQ | metrics / screenshot / creator-import consumed | OK |
| Worker | `Thinkway-Platform-Production` @ `main` `34ca1bc` | OK |

---

## 6. Residual notes (non-blocking)

| Item | Note |
|---|---|
| App producer `{url}` shape | `lib/performance/metrics-collector/queue.ts` and creator-import `getConnectionOptions()` still pass `{ url }` (ioredis ignores → localhost risk). Screenshot / Discovery producers use correct connections. Smokes used explicit host/port options against Prod Redis. **Recommend a follow-up code fix + redeploy** (out of this rollout scope). |
| Accidental project | Transient `tw-prod-deploy` from a mislinked worktree was **deleted**; no lasting infra. |
| Dev `/api/version` | Behind Vercel deployment SSO (`302`); isolation verified via Redis/DB, not that endpoint. |
| Smoke fixture | One Production influencer row may remain from `tw_prod_smoke_noop` import; safe to leave or clean via normal admin tools. |

---

## 7. Rollback

- App: `vercel promote` / alias prior Production deploy `dpl_EQFDAW6LW9LiMQAp8SuCxU8yELUE` (previous `app.thinkwaymedia.com` target).  
- Worker: leave running; scale to 0 only if queue processing must stop.  
- Do **not** change Development worker.
