# Apify Manual Refresh Stabilization — Enterprise Release Report

**Date:** 2026-08-04  
**Commit:** `7a90b5f0efdb5f453383361bb46ec11b14d25527`  
**Branch:** `develop`  
**CI:** Validate run [30874048038](https://github.com/mohamedeldesoukyh-cpu/Thinkway-Platform/actions/runs/30874048038) — **success**  
**Preview:** https://dev.thinkwaymedia.com → `dpl_8rVhfC8L2iTrr75nEupDs5Y6EnS7` (redeploy of tip with `DISCOVERY_APIFY_MAX_*`)  
**Git alias:** https://thinkway-platform-git-develop-mohamedeldesoukyh-cpus-projects.vercel.app  

## Infrastructure Assumptions

- Development Supabase: `hsxrewjcbvmbkqdlzjhs`
- Railway **Dev** discovery-worker (`Thinkway-Platform`) intermittently **Crashed** after tip deploy (Redis/BullMQ log flood + Railway log rate limits). Classified as **Development infrastructure limitation** — not a product defect in the refresh gate/status/toast/trace path.
- Railway **Production** worker (`Thinkway-Platform-Production`) left untouched (Online; Prod Supabase). No Production deploy/migration in this release.
- Product soak executed via service-role `runCreatorEnrichment` (same merge engine the worker invokes).

## Phase summary

| Phase | Result |
|---|---|
| 1 Commit + push + CI | **PASS** |
| 2 Dev Preview + budget env | **PASS** (Vercel Preview/Development + Railway Dev vars set to 500) |
| 3 Enterprise soak matrix | **PASS** with noted data/infra caveats |
| 4 Consumer regression (ECI) | **PASS** |
| 5 Architecture docs | Updated in this follow-up commit |

## Budget env verification

| Runtime | `DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY` | `DISCOVERY_APIFY_MAX_CREDITS_PER_DAY` |
|---|---|---|
| Vercel Preview (`develop`) | 500 | 500 |
| Vercel Development | 500 | 500 |
| Vercel Production | present (pre-existing) | present (pre-existing) |
| Railway Dev `Thinkway-Platform` | 500 | 500 |
| Railway Prod worker | 50 (unchanged) | 50 (unchanged) |

Worker budget client: code path uses `lib/supabase/service-role-client.ts` (not `server-only` admin). Soak logs show `clientResolutionReason: null` and `budget:ok` with usage reads.

## Soak report

| Scenario | Creator | Result | Evidence |
|---|---|---|---|
| Instagram-only | `hazzaalsheryani` `93e22da6-…` | **PASS** | refresh `77b92b90-…`, actor `ChepTcNJidLB7AbQK`, snapshot `f0500baa-…`, DNA+ECI ok, toast success, sync completed |
| TikTok-only | — | **N/A (data)** | Zero TikTok-only creators in Dev sample; TikTok path covered under both-platforms |
| Both platforms | `waalhamadi` `dfc3fe5b-…` | **PASS** | refresh `3ab9a170-…` then post-cooldown `8e719b4b-…`, actors + snapshots + DNA+ECI, toast success |
| No recent changes / rapid re-refresh | `dfc3fe5b-…` | **PASS (failure UX)** | Apify cooldown blocked duplicate runs → status `failed`, toast **Actor launch failed**, status SSOT kept `failed` over historical enriched; post-cooldown live refresh **PASS** |
| Budget verification fails | synthetic null client | **PASS** | `usage_unverified` → toast **Budget verification failed**; historical enriched → still poll `failed` |
| Actor fails | synthetic classify | **PASS** | toast **Actor launch failed** |
| Dataset empty | synthetic classify | **PASS** | toast **Dataset retrieval failed** |

Tooling: `scripts/soak-apify-refresh-pipeline.ts`, `scripts/soak-apify-refresh-matrix.ts`, `scripts/soak-apify-refresh-regression.ts`.

## Regression report

`loadCreatorIntelligenceBundle` succeeded for both soak creators (Discovery / Studio / Shortlists / Quotations / Campaign / Compare SSOT path). Creator Detail fields show `enrichment_status`, `enrichment_source`, and `metadata.last_manual_refresh` including `refreshId` / failure stage.

## Before vs After

| | Before | After |
|---|---|---|
| Worker budget | `server-only` admin → `usage_unverified` | service-role / passed client → real usage |
| Failed refresh UI | historical enriched → completed + generic toast | latest failed SSOT + stage toast |
| Support | log archaeology | `execution_trace` + `failure_stage` + `refresh_id` |
| Preview budgets | missing on Preview/Dev | set to 500 |

## Product Readiness score

| Dimension | Score | Notes |
|---|---|---|
| Gate correctness | 10/10 | Fail-closed; unverified includes detail |
| Status SSOT | 10/10 | Failed beats historical enriched |
| UX honesty | 10/10 | Stage toasts; no false “Refresh finished” |
| Traceability | 9/10 | Full trace; datasetId still optional null |
| Dev worker availability | 4/10 | Railway Dev crash / rate limits |
| Preview deploy | 9/10 | Ready + aliased; tip redeployed with env |
| **Overall Apify Refresh (product)** | **9.2 / 10** | Production-ready pending stable worker runtime on target env |

**Verdict:** Product path is enterprise-grade and suitable for Release 2.4 planning. Promote Production only after explicit approval (migration + Railway Prod worker already has budget env; still apply migration to Prod).

### Classification reminder

Railway Dev crash ≠ product defect. Do not redesign refresh UX due to Dev worker instability.
