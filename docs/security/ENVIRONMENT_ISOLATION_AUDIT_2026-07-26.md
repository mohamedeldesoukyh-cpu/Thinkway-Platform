# Environment Isolation Audit

**Date:** 26 July 2026  
**Mode:** Read-only (no secret rotation, env changes, deployments, or DB modifications)  
**Evidence sources:** `vercel env ls --format json`, live `/api/build-info` via `vercel curl`, local/worker `.env` fingerprints (SHA-256 prefix only), repo config (`vercel.json`, `RELEASE_WORKFLOW.md`, worker docs)

---

## Executive verdict

| Control | Status |
|---------|--------|
| Dev vs Prod **Supabase projects** (canonical hosts) | **PASS** — live build-info aligned |
| Dev vs Prod **service role / Redis** presence | **PARTIAL** — Prod has both; Preview/`develop` missing Redis + service role |
| Preview **never** uses Prod secrets | **FAIL** — shared `Production+Preview` public Supabase URL/anon still attached |
| Production deploy requires approval | **FAIL / WEAK** — `ignoreCommand` present, but Ready Production deploys from `main` continue |
| Local defaults to Development | **PASS** (app `.env` → `hsxrewj…`; Redis localhost) |
| Worker isolation (Railway) | **UNKNOWN** — not inspectable in this audit (no Railway CLI auth) |

**Overall:** Canonical **develop → Dev Supabase** and **Production → Prod Supabase** are working for the aliased hosts. Isolation is **not complete**: Preview association leakage, missing Dev Redis/service-role on Preview, and incomplete Production Git deploy gating.

---

## 1. Environment inventory

| Environment | Purpose | Domain (intended) | Vercel env | Git |
|-------------|---------|-------------------|------------|-----|
| Local | Engineer workstation | `localhost` | N/A | any |
| Development (hosted) | Integration / Ops | `dev.thinkwaymedia.com` | Preview + branch `develop` | `develop` |
| Preview (other) | PR / feature previews | `*.vercel.app` | Preview (no branch) | feature branches |
| Production | Live customers | `app.thinkwaymedia.com` | Production | `main` (policy: approval only) |
| CI (GitHub Actions) | Validate / measure | N/A | Secrets (repo) | PR + `main` |
| Worker (Railway) | BullMQ consumers | N/A | Railway service vars | deploy separate |

**Vercel project:** `thinkway-platform` (`prj_GQ3PcSIedDuhKdzwLVfHPqeJzKzr`)  
**Supabase org projects (CLI list):** `thinkway-dev` `hsxrewjcbvmbkqdlzjhs` · `thinkway-production` `ienowhwfyxoqtzbgltno`

---

## 2. Environment matrix (approved architecture)

| Dimension | Local | Development (`develop`) | Preview (non-develop) | Production |
|-----------|-------|-------------------------|----------------------|------------|
| **Purpose** | Day-to-day coding | Hosted Dev | Ephemeral PR | Live |
| **Domain** | localhost | `dev.thinkwaymedia.com` | `*.vercel.app` | `app.thinkwaymedia.com` |
| **Supabase** | `hsxrewj…` (Dev) | `hsxrewj…` | **Must be Dev or none** — currently risks Prod public URL | `ienow…` |
| **Storage** | Dev buckets | Dev buckets | Same as Supabase project | Prod buckets |
| **Redis** | localhost | **Dedicated Dev Redis (required)** | none / Dev Redis | Prod `REDIS_URL` |
| **Background worker** | Local `discovery:worker:dev` | Dev worker (or shared with care) | N/A | Railway → Prod Supabase + Prod Redis |
| **Vercel project** | — | `thinkway-platform` Preview/`develop` | same Preview | same Production |
| **Secret owner** | Engineer laptop | Vercel Preview/`develop` + Dev Supabase | Vercel Preview | Vercel Production + Prod Supabase + Railway |

### Live alignment evidence (`/api/build-info`)

| Host / surface | `environment` | `supabaseProjectRef` | `expectedSupabaseProjectRef` | `supabaseAligned` |
|----------------|---------------|----------------------|------------------------------|-------------------|
| `dev.thinkwaymedia.com` (Preview/`develop`) | `development` | `hsxrewjcbvmbkqdlzjhs` | `hsxrewjcbvmbkqdlzjhs` | **true** |
| `app.thinkwaymedia.com` (Production) | `production` | `ienowhwfyxoqtzbgltno` | `ienowhwfyxoqtzbgltno` | **true** |

---

## 3. Secret / variable audit (Vercel associations)

Classification from `vercel env ls` (values not printed; sensitive pull omitted values).

### Shared (unsafe) — Production + Preview, no branch

| Variable | Classification | Risk |
|----------|----------------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Shared Prod+Preview** | Non-`develop` Preview can receive **Production** public URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Shared Prod+Preview** | Same — Production anon on arbitrary Preview |

Branch override exists for Preview/`develop` (Dev URL/anon). Override does **not** protect other Preview branches.

### Production only

`SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `APIFY_TOKEN`, `DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION`, Apify day limits, plus Production copies of `THINKWAY_ENV`, `NEXT_PUBLIC_*` app URLs, `EXPECTED_SUPABASE_PROJECT_REF`, `CRON_SECRET`, `OPENAI_API_KEY`, `CSRF_ALLOWED_ORIGINS`.

### Preview / `develop` only (present)

`THINKWAY_ENV`, `NEXT_PUBLIC_THINKWAY_ENV`, `NEXT_PUBLIC_APP_URL`, dual app URLs, `EXPECTED_SUPABASE_PROJECT_REF`, `CSRF_ALLOWED_ORIGINS`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRON_SECRET`, `OPENAI_API_KEY`.

### Missing on Preview/`develop` (gaps)

| Variable | Impact |
|----------|--------|
| `REDIS_URL` | BullMQ / rate-limit / worker enqueue on Dev host broken or no-op |
| `SUPABASE_SERVICE_ROLE_KEY` | Server paths needing admin client fail on Dev host |
| `APIFY_TOKEN` | Enrichment on Dev host limited vs Prod |

### Shared (safe) — documentation / public URLs

`NEXT_PUBLIC_DEVELOPMENT_APP_URL` / `NEXT_PUBLIC_PRODUCTION_APP_URL` intentionally duplicated on both surfaces (navigation only).

### Local fingerprints (no values)

| Surface | Supabase ref | Redis | Notes |
|---------|--------------|-------|-------|
| `.env` | `hsxrewj…` | localhost | Service-role JWT length 219 (plausible) |
| `services/discovery-worker/.env` | `hsxrewj…` (via `SUPABASE_URL`) | localhost (same FP as local Redis) | `SUPABASE_SERVICE_ROLE_KEY` FP ≠ local; length **41** (suspicious / likely invalid) |
| Local vs Worker | — | **same Redis URL** | Expected for local |
| Local vs Worker | — | — | **same Apify token FP** |

---

## 4. Isolation checks

### Different Dev vs Prod (requirement 3)

| Asset | Different? | Evidence |
|-------|------------|----------|
| Supabase project | **Yes** | Live build-info refs |
| Anon key association | **Intended yes** for `develop`; shared slot still exists | env ls |
| Service role | Prod only on Vercel | env ls |
| Redis | Prod only on Vercel; Dev Redis **not configured** | env ls |
| DB passwords | Separate projects ⇒ separate | Org project list |
| Storage | Per-project buckets | Implied by project split |
| API secrets (`CRON_SECRET`, `OPENAI`) | Separate Vercel slots Prod vs Preview/`develop` | Values may still match — not verifiable (sensitive pull blank) |

### Preview never uses Production secrets (requirement 4)

**Not met** for non-`develop` Preview: shared `NEXT_PUBLIC_SUPABASE_URL` + `ANON` target Production+Preview.

### Production deploy approval (requirement 5)

| Control | Finding |
|---------|---------|
| `vercel.json` → `ignoreCommand` → `vercel-ignored-build-step.mjs` | Present; skips Prod Git builds unless `[deploy-production]` |
| Observed `vercel list` | Multiple **Ready Production** deployments in last ~2–48h from `main` |
| Conclusion | Gate is **insufficient / bypassed** (CLI `--prod`, force flag, or ignore-step not applied consistently) |

### Workers (requirement 8)

| Worker | Intended | Verified |
|--------|----------|----------|
| Local discovery-worker | Dev Supabase + local Redis | Points at Dev URL; Redis localhost |
| Railway discovery-worker | Prod Supabase + Prod Redis | **Not verified** this audit |
| Vercel serverless enqueue | Uses deployment `REDIS_URL` | Prod has Redis; Dev Preview **missing** Redis |

### Local cannot target Production (requirement 9)

| Path | Status |
|------|--------|
| App `.env` Supabase | Dev project — good |
| Local Redis | localhost — good |
| Supabase CLI `.temp` | Still stale legacy ref (SEC-001) — CLI risk if used with `--linked` |
| Accidental Prod via Preview shared vars | Risk for **hosted** non-develop Preview, not local |

---

## 5. Risk assessment

| ID | Severity | Finding |
|----|----------|---------|
| ENV-01 | **High** | `NEXT_PUBLIC_SUPABASE_URL` / `ANON` still `Production+Preview` — non-develop Previews can talk to **Production** PostgREST with Prod anon |
| ENV-02 | **High** | Production Git deploys still completing without reliable approval gate |
| ENV-03 | **High** | No Development `REDIS_URL` on Preview/`develop` — queue/worker isolation incomplete |
| ENV-04 | **Medium** | No `SUPABASE_SERVICE_ROLE_KEY` on Preview/`develop` — Dev host missing admin paths |
| ENV-05 | **Medium** | DNS for `thinkwaymedia.com` still on GoDaddy NS (not Vercel) — domain alias reliability risk |
| ENV-06 | **Medium** | CI `validate.yml` injects `SUPABASE_SERVICE_ROLE_KEY` (project unknown; likely Dev) — supply-chain blast radius |
| ENV-07 | **Low** | Local worker service-role length/fingerprint anomaly |
| ENV-08 | **Informational** | Sensitive Vercel values not exportable via `env pull` for fingerprint comparison |

---

## 6. Required remediation (do not execute in this audit)

1. **Detach** Preview from shared Prod `NEXT_PUBLIC_SUPABASE_URL` / `ANON` entirely (`vercel env rm … preview` for the shared entries; keep only Preview/`develop` Dev values).  
2. Add **dedicated Development Redis**; set `REDIS_URL` on Preview/`develop` only (never Prod Redis).  
3. Set **Dev** `SUPABASE_SERVICE_ROLE_KEY` on Preview/`develop` only.  
4. **Structurally** disable auto Production deploys from `main` in Vercel (Production branch protection / manual promote); treat `ignoreCommand` as defense-in-depth only.  
5. Confirm Railway worker env → Prod Supabase + Prod Redis only; document in Ops Center.  
6. Align CI secrets to Dev project ref assert; avoid Prod service-role in Actions.  
7. Fix local Supabase CLI link (SEC-001) + worker service-role if invalid.  
8. Complete DNS cutover for `dev` / `app` to Vercel.

---

## 7. Validation report checklist

| Check | Result |
|-------|--------|
| Environment separation (canonical hosts) | **Pass** (build-info) |
| Secret isolation (Preview vs Prod) | **Fail** (shared public Supabase) |
| Worker isolation | **Partial / unknown** (Railway unchecked; Dev Redis missing) |
| Deployment protection | **Fail / weak** (Prod deploys observed) |
| Env var mapping (`develop` → Dev) | **Pass** for develop overrides |
| No Production secret exposure to Preview | **Fail** for public Supabase on shared Preview |
| No cross-env DB on canonical hosts | **Pass** for `dev` / `app` build-info |

---

## Constraints honored

- Investigation only  
- No secret rotation  
- No environment changes  
- No deployments  
- No database modifications  
- No secret values written to disk in this report (fingerprints / presence / project refs only)
