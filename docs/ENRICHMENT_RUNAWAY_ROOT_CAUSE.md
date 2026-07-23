# Runaway Enrichment — Root-Cause Report

**Status:** Investigation only — no behavior changes  
**Date:** Jul 2026  
**Symptoms:** Enrichment enqueued for creators never explicitly requested; workers continuously busy; BullMQ overloaded; UI unstable; Apify credits burning rapidly.

---

## Executive verdict

There is **no closed recursive loop** where commercial enrichment writes to Postgres and a DB trigger / realtime listener re-enqueues the same job.

The runaway behavior is explained by **three automatic / poorly gated producers** that can flood queues and Apify without a per-creator user click:

| # | Producer | Queue(s) | Apify? | User requested each creator? |
|---|----------|----------|--------|------------------------------|
| 1 | **Coverage / dataset acquisition backfill** on Discovery browse & AI search | `discovery-run`, `enterprise-acquisition` | **Yes (bulk dataset actors)** | **No** — system decides “coverage insufficient” |
| 2 | **Commercial creator enrichment** with `force` defaulting to `true` + batch Decision Engine **not short-circuiting** | `creator-enrichment`, `batch-profile-acquisition` | **Yes (per creator / batch)** | Only if user refreshed/bulk-selected; freshness bypassed |
| 3 | **Legacy discovery refresh cron** (every 6h → up to 50 profiles) | `discovery-refresh` → `discovery-enrich` | No (Playwright crawl) | No — scheduled |

**Campaign Intelligence / Forecast Foundation do not enqueue enrichment.** They read enrichment / DNA data. CIP can, however, drive browse + coverage backfill (#1) via `browseUnifiedCreatorsWithCoverageBackfill`.

**Default CCC `automaticEnrichment: "never"`** means shortlist auto-enrich should be off unless Control Center was changed in the DB. Cost protection defaults (`maxCreditsPerDay: 0`, `maxRequestsPerDay: 0`) mean **unlimited Apify** — no daily brake.

---

## Phase 1 — Every path that can enqueue creator enrichment

### A. Commercial Apify enrichment (`creator-enrichment` / `batch-profile-acquisition`)

| Path | File / symbol | Initiator | Auto? |
|------|---------------|-----------|-------|
| A1 Manual refresh (single) | `features/discovery/enrichment/actions.ts` → `refreshCreator*Action` → `refreshCreatorMetrics` | UI Refresh menus / buttons | User |
| A2 Batch refresh | `refreshCreatorsBatchAction` → `refreshCreatorMetricsBatchByUnifiedIds` (`force: true`, `isBulk: true`) | Discovery / shortlist bulk bar | User (selected set) |
| A3 Add by profile URL | `lib/discovery/add-creator-by-profile-url.ts` | Add Missing Creator / Studio URL add | User action → auto enqueue |
| A4 Add platform | `lib/discovery/add-platform-to-creator.ts` | Add platform dialog | User action → auto enqueue |
| A5 Edit profile URL | `lib/discovery/update-platform-profile-url.ts` | Edit URL (force only if identity changed) | User action → conditional |
| A6 Shortlist auto-enrich | `features/discovery/shortlists/actions.ts` ~770 → `enqueueCreatorEnrichmentBestEffort` | Add to shortlist | **Automatic** if CCC allows |
| A7 Studio staged enrich | `add-creator-panel.tsx` → `refreshCreatorAllAction` | Explicit “Refresh Intelligence” or URL-add flow | User |
| A8 Repair CLI | `scripts/repair-offline-import-country-completeness.ts` | Operator script (`force: true`) | Ops |
| A9 Detail auto | `enqueueCreatorDetailEnrichment` | — | **Stub / disabled** |
| A10 Campaign / stale triggers | typed in policy | — | **No live producer** |

**Core write:** `enqueueCreatorEnrichmentImpl` (`lib/creator-enrichment/queue-impl.ts`)  
**Public API:** `enqueueCreatorEnrichment` / `refreshCreatorMetrics` via `CreatorEnrichmentOrchestrator`

### B. Related queues that look like “enrich” but are different

| Path | Queue | Apify? | Notes |
|------|-------|--------|-------|
| B1 Coverage backfill | `discovery-run` / `enterprise-acquisition` | **Yes** | Auto on browse/AI when coverage/intelligence insufficient |
| B2 Dataset import | same workers | **Yes** (dataset run); per-creator live backfill **off** (`allowLiveApifyBackfill: false`) | Does **not** currently increment `enrichmentJobsQueued` / push `creator-enrichment` |
| B3 Legacy profile enrich | `discovery-enrich` | No | Playwright crawl |
| B4 Legacy scheduler | `discovery-scheduler` → `discovery-refresh` | No | Cron every 6h, limit 50 due profiles |
| B5 OpenGraph / avatar proxy | sync / background | No | Not commercial enrich |

No Supabase Edge Function / RPC enqueues commercial enrichment.

---

## Phase 2 — Call graph

```text
┌─────────────────────────────────────────────────────────────────┐
│ Discovery Browse / AI Search / CIP creator search                 │
│   browseUnifiedCreatorsWithCoverageBackfill                       │
│   progressive-creator-search → maybeTriggerCoverageBackfill       │
└────────────────────────────┬────────────────────────────────────┘
                             │ if coverage / intelligence insufficient
                             │ OR discoverySource = apify_live_only
                             ▼
              gateApifyBackfill (CCC + cost — 0/0 = unlimited)
                             │
                             ▼
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
   discovery-run                        enterprise-acquisition
   (legacy worker)                      (dataset Apify actor)
         │                                       │
         │                                       ▼
         │                          importApifyStoredPayloadWithDnaPipeline
         │                          (allowLiveApifyBackfill: false)
         │                                       │
         │                                       ▼
         │                          influencers / IPA / DNA (no re-enqueue)
         └───────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ User refresh / shortlist / add-URL                                │
│   refreshCreatorMetrics* | enqueueCreatorEnrichment*              │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
              CreatorEnrichmentOrchestrator + Decision Engine
                ForceRule(500) → QueueRule(400) → FreshnessRule(300)
                             │
          ┌──────────────────┴──────────────────┐
          │ force default TRUE                  │ batch: DE runs but
          │ → FreshnessRule bypassed            │ ALWAYS delegates
          ▼                                     ▼
   refreshCreatorMetricsImpl          batch-profile-acquisition
          │                                     │
          ▼                                     ▼
   creator-enrichment (BullMQ)          Apify multi-URL batch
          │
          ▼
   creator-enrichment.worker
          │
          ▼
   runCreatorEnrichment → fetchApifyProfile* → UPDATE influencers/IPA
          │
          ▼
   DNA bridge / audit runs
          │
          ✗ NO DB trigger / realtime re-enqueue

┌─────────────────────────────────────────────────────────────────┐
│ Legacy scheduled loop (intentional, time-delayed)                 │
│   cron 6h → discovery-refresh → discovery-enrich → crawl          │
│   → set discovered_profiles.next_refresh_at → later cron again    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 3 — Recursive / circular workflows

| Loop? | Path | Assessment |
|-------|------|------------|
| Sync recursion A→write→A | Commercial enrich → DB | **None** — no triggers/subscriptions re-enqueue |
| Time-delayed loop | Legacy `next_refresh_at` ↔ cron | **Yes, by design** (Playwright, not Apify) |
| Soft amplification | Browse → coverage Apify → many imports → UI/browse again → coverage still low → more Apify | **Yes — operational feedback loop** (not a code recursion) |
| Soft amplification | Bulk refresh `force:true` + DE not gating batch | **Yes — volume amplifier** |
| Forecast / Campaign Decision Engine | — | **No enqueue** |

---

## Phase 4 — Gate enforcement matrix

| Gate | Single refresh | Batch refresh | Shortlist auto | Coverage backfill | Legacy cron |
|------|----------------|---------------|----------------|-------------------|-------------|
| CCC / env `canEnqueueCreatorEnrichment` | Yes | Yes | Yes (+ CCC auto mode) | N/A (different queues) | N/A |
| Decision Engine short-circuit | Yes | **No — decide then always delegate** | Yes (via enqueue API) | No DE | No DE |
| FreshnessRule | **Bypassed when `force` (default true)** | Bypassed (`force: true` in action) | Applied (`force: false`) | N/A | N/A |
| Inflight / jobId dedupe | Yes (post-fix for prioritized jobs: `ab774db`) | Batch cancels per-creator jobs | Yes | Separate jobIds | Weak (can pile `discovery-enrich`) |
| Cost protection | Not on commercial path | Not on commercial path | Not | **0/0 = unlimited** | N/A |

**Critical gaps:**

1. `buildJobPayload`: `force: options.force ?? true` for live Apify — FreshnessRule almost never runs on UI paths.  
2. `requestBatchRefresh`: Decision Engine is **advisory only**.  
3. CCC cost caps default to **disabled** (`<= 0` → allow).  
4. Commercial `influencers.next_refresh_at` is written but **never consumed** by a scheduler (`"stale"` trigger unused).

---

## Phase 5 — Recent product changes vs this incident

| Area | Enqueues commercial enrichment? | Role in runaway |
|------|----------------------------------|-----------------|
| Campaign Intelligence / Studio | No (reads / Studio manual refresh only) | Indirect: CIP search uses coverage-backfill orchestrator |
| Creator Intelligence phases E–I / acquisition-gate telemetry | No direct enqueue | Strengthens / observes acquisition gate; can increase backfill triggers when sufficiency fails |
| Forecast Foundation | No | Read-only of `last_enriched_at` / publications |
| Enrichment orchestrator + DE | Yes | Intended; force + batch gaps undermine it |
| Prioritized BullMQ inflight fix (`ab774db`) | — | Previously allowed duplicate/invisible inflight — could worsen pile-up before fix |

**Conclusion:** No new “secret” enrich trigger from Forecast. The dangerous automatic Apify path is **coverage / enterprise dataset acquisition**, amplified by CIP/AI search using the same browse+backfill stack. Commercial queue overload is most consistent with **forced bulk refresh**, **shortlist auto if CCC ≠ never**, and/or **ops repair scripts**, not a DB trigger loop.

---

## Phase 6 — What matches the observed symptoms

| Symptom | Most likely source |
|---------|-------------------|
| Creators “never requested” | Coverage/dataset acquisition importing many handles; and/or shortlist auto / bulk select-all refresh |
| Workers always busy | `creator-enrichment` (concurrency 1) + `enterprise-acquisition` + legacy `discovery-enrich` |
| BullMQ overloaded | Same queues + refresh cron every 6h |
| Apify credits burning | Dataset acquisition actors + per-creator `fetchApifyProfile` on commercial jobs |
| UI unstable | Polling + Redis/worker contention + long page hydrations under load |

---

## Recommended minimal fix (do not implement yet)

Ordered for **smallest change that breaks the runaway while preserving intentional enrich**:

### P0 — Immediate kill switches (ops, no code)

1. Set CCC / env: `DISABLE_CREATOR_ENRICHMENT=true` **or** pause worker consumers for `creator-enrichment` + `enterprise-acquisition` until backlog drains.  
2. Set Discovery Control: `discoverySource = platform_database_only` (stops coverage Apify) and confirm `automaticEnrichment = never`.  
3. Drain/pause BullMQ: `creator-enrichment`, `batch-profile-acquisition`, `enterprise-acquisition`, optionally `discovery-enrich`.  
4. Stop any running `repair-offline-import-country-completeness` (or similar) CLI.

### P1 — Minimal code fixes (preserve intended enrich)

1. **Default `force` to `false`** in `buildJobPayload`; require explicit `force: true` only from confirm-dialog / “force live Apify” UX. Restores FreshnessRule + `decideEnrichment` on normal refresh.  
2. **Honor Decision Engine on batch:** `requestBatchRefresh` must short-circuit when decision is skip / already_running (filter IDs or abort).  
3. **Hard-cap coverage Apify:** treat `maxCreditsPerDay` / `maxRequestsPerDay` defaults as safe non-zero in production, or fail closed when unset; enforce on commercial Apify too.  
4. **Coalesce coverage backfill:** stronger CIP cooldown + single in-flight acquisition per search session (prevent browse/scroll/AI from stacking jobs).

### P2 — Follow-ups (not required to stop the bleed)

- Wire or delete unused `"stale"` commercial scheduler.  
- Cap legacy refresh worker further / exclude high-volume stages.  
- Emit a single “enrichment storm” metric: jobs enqueued/min by `trigger` + `feature`.

---

## Success criteria for the eventual fix

- No Apify commercial run without an explicit user force **or** a CCC-allowed auto trigger that passed freshness.  
- Batch refresh cannot enqueue more creators than Decision Engine + freshness allow.  
- Coverage backfill cannot exceed daily credit/request caps.  
- BullMQ depth for `creator-enrichment` returns to near-zero at idle.  
- Opening Discovery browse does not enqueue `creator-enrichment` jobs.

---

## Key files

- `lib/creator-enrichment/queue-impl.ts` — BullMQ enqueue  
- `lib/services/creators/creator-enrichment-service-impl.ts` — `force ?? true`, batch acquisition branch  
- `lib/creator-enrichment/orchestrator/creator-enrichment-orchestrator.ts` — batch ignores DE skip  
- `lib/creator-enrichment/decision/rules/{force,queue,freshness}-rule.ts`  
- `lib/discovery/coverage-backfill-orchestrator.ts` / `coverage-backfill.ts`  
- `lib/discovery/dataset-acquisition-orchestrator.ts`  
- `lib/discovery/control-center/discovery-control-policy.ts` — auto enrich + cost (0 = unlimited)  
- `features/discovery/shortlists/actions.ts` — shortlist auto enqueue  
- `services/discovery-worker/src/workers/{creator-enrichment,enrichment,refresh}.worker.ts`  
- `services/discovery-worker/src/schedulers/refresh-scheduler.ts`
