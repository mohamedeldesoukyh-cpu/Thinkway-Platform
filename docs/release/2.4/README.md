# Release 2.4 — Kickoff

**Status:** 🌱 **Prepared** (not yet Feature Freeze) · Apify Refresh **Enterprise Ready** (carry-in baseline)  
**Opened after:** Release 2.3 Production Acceptance **PASS** + tag `v2.3.1`  
**Date:** 2026-08-04 (baseline refreshed; Apify Refresh closed)  
**Baseline tip:** `develop` @ `695f8b47` (includes Apify Refresh `7a90b5f0`)  
**Branch:** `release/2.4` (baseline only until Product scopes implementation)  

**Production:** unchanged until **explicit** Production Approval — do not “fix” Production outside a scheduled Production deployment.

---

## Purpose

Open the next initiative window after R2.3 closure. **No architecture redesign and no production deploy** until Product scopes and approves a Release 2.4 package.

---

## Enterprise Ready baseline (closed before R2.4 product waves)

### Apify Manual Refresh pipeline — **Enterprise Ready**

| Field | Value |
|---|---|
| Status | **CLOSED · Enterprise Ready** (product path) |
| Tip | `7a90b5f0` (+ docs `e66af79b`) |
| Architecture | `docs/APIFY_CREATOR_ENRICHMENT_ARCHITECTURE.md` (§ Manual refresh stabilization) |
| Release evidence | `docs/architecture/APIFY_REFRESH_STABILIZATION_ENTERPRISE_RELEASE.md` |
| Migration (Dev applied) | `supabase/migrations/20260804120000_creator_refresh_execution_trace.sql` |
| Soak tooling | `scripts/soak-apify-refresh-pipeline.ts` · `scripts/soak-apify-refresh-matrix.ts` · `scripts/soak-apify-refresh-regression.ts` |

**Include in R2.4 planning (architecture / diagnostics):**

1. **Budget verification flow** — fail-closed; worker-safe `lib/supabase/service-role-client.ts` (never `server-only` admin on Railway).  
2. **Status precedence** — latest influencer `failed` beats historical platform `enriched` (no false completed).  
3. **Failure stages + toasts** — budget / actor / dataset / snapshot / DNA / ECI / no profile changes.  
4. **Execution trace** — `creator_enrichment_runs.refresh_id` · `failure_stage` · `execution_trace` jsonb.  
5. **Runtime env** — positive `DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY` / `DISCOVERY_APIFY_MAX_CREDITS_PER_DAY` on Vercel Preview + discovery-worker.  
6. **Support troubleshooting** — read latest terminal enrichment run + stage toast mapping.

**Production promote (separate approval):** apply migration + confirm worker env on Production only when Product schedules a Production deployment. Until then **keep Production unchanged**.

**Not a R2.4 product blocker:** Dev Railway worker crash — see infra backlog below.

---

## Carry-forward candidates (from R2.3 residuals / backlog)

| Theme | Notes | Priority (TBD) |
|---|---|---|
| Client IO recipients / send UX | Fresh TW-2026-0002: document generated; Send gated on recipients | Ops / Commercial |
| OPS-EMAIL Production proof | Carry-forward from R2.2 if Client/Vendor IO outbound still unproven | Ops |
| Wave 1 Studio live-discovery | Explicitly **excluded** from R2.3 tip — decide include/exclude for R2.4 | Product |
| CIP / Studio slate hardening | Hotfixes shipped in R2.3 close tip; soak + regression suite | Eng |
| Inventory hygiene | Older packages with non-resolvable slate IDs | Data |
| Change Impact / Doc Lifecycle depth | Schema live in R2.3 — productize remaining UX | Product |
| Apify Refresh Production promote | Migration + worker verify on Prod when scheduled | Eng / Ops (approval-gated) |

---

## Development infrastructure (separate from product)

| ID | Title | Status | Notes |
|---|---|---|---|
| DEV-INFRA-RAILWAY-WORKER | Railway Dev discovery-worker crash (Redis / log rate limits) | Open | `docs/infrastructure/BACKLOG_DEV_RAILWAY_WORKER_REDIS_LOG_RATE_LIMITS.md` — **Dev infra only** |

---

## Governance

| Rule | Application |
|---|---|
| Development first | Implement/test on `develop` + Dev Supabase `hsxrewjcbvmbkqdlzjhs` |
| Production | Only after explicit Production Approval package |
| Feature Freeze | Not in force until Product declares R2.4 freeze |
| Exclusions | Do not ship local `scripts/tmp-*` or unapproved Wave 1 work without Product OK |
| Infra vs product | Never classify Railway Dev unavailability as Apify Refresh product failure |

---

## Immediate next steps (Product)

1. Confirm R2.4 themes / out-of-scope list (Apify Refresh is **closed** as Enterprise Ready baseline — not an open product wave).  
2. Author `docs/architecture/RELEASE_2_4_ARCHITECTURE.md` (or equivalent) when scope is agreed.  
3. Open `feature/release-2-4-*` branches from `develop` only after scope approval.  
4. Optionally schedule Apify Refresh **Production** promote as a gated ops item (not “drive-by” fixes).

**Do not** treat this README as Production authorization.
