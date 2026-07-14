# Creator Intelligence — Production Rollout Runbook

**Scope:** move `CREATOR_INTELLIGENCE_MODE` OFF → SHADOW → ON → CLEANUP with zero
downtime, measurable gates, and single-flag rollback at every stage.
**Companion:** `docs/CREATOR_INTELLIGENCE_ARCHITECTURE.md` (design + ownership map).

---

## 0. Traffic map (what the flag actually governs)

Verified by repo audit (2026-07-13):

**CI-GATED PATH (flag applies).** Every consumer of
`browseUnifiedCreators[WithCoverageBackfill]` — 19 entry modules including:
Discovery creator-search workspace (`browseUnifiedCreatorsAction`), AI/Studio
search (`production-executors` → `searchCreatorsInputToBrowseFilters`),
`app/api/campaigns/influencers`, campaign-object export, similar-creators,
slate edit/reoptimize/commit, `lib/creators/campaign-match`. Downstream of the
same flag: `unified-ranking` category score, `campaign-relevance-scoring`
category criterion, `campaign-fit-rerank` prompt context, acquisition-gate
coverage telemetry.

**BYPASSES (flag does NOT apply — SQL/legacy reads).**
1. `app/api/discovery/search` → `searchDiscoveredProfiles` → SQL
   `category_tags && …` (case-sensitive overlap).
2. Discovery workspace "match brief" → `lib/discovery/campaign-match.ts` →
   same SQL path.
3. `features/campaigns/components/creator-detail-sheet.tsx` — renders stored
   tags directly (display-only).
4. `features/discovery/shortlists/export/shortlist-document.ts` — category
   breakdown from stored tags (export display).
5. SQL pre-filters everywhere: rows excluded by `category_tags`/`categories`
   predicates never reach the post-filter, so in ON mode recovery is limited to
   rows in the fetched page until the predicate flip (Stage 3b).

**SQL surfaces still on legacy columns:** `lib/discovery/search.ts` (2 ×
`category_tags` overlap), `lib/creators/unified-browse.ts:725`
(`influencers.categories` overlap), RPCs `browse_influencer_ids_for_categories`,
`get_discovery_database_stats`, `get_discovery_search_taxonomy`; worker upsert
writes `category_tags`.

---

## 1. Sequencing (order is mandatory)

| # | Step | Why this order |
|---|---|---|
| 0 | Deploy current main; CI runs `test:bullmq-connection` | producer/worker Redis parity must hold before any queue-dependent stage |
| 1 | Apply migration `20260713120000_creator_intelligence_projection.sql` | additive; no reader yet |
| 2 | **SHADOW** (web app env) 5–7 days | telemetry before any behavior change |
| 3 | `npm run backfill:creator-intelligence` + enrichment spend to coverage gate | ON without coverage just falls back to legacy (safe but pointless) |
| 4 | **ON** (web app env) | post-filter + ranking + rerank on resolved intelligence |
| 5 | Predicate flip (SQL reads projection) — separate deploy | needs populated projection; biggest blast radius, own rollback |
| 6 | `DISCOVERY_WRITE_INTENT_TAGS=false` (worker env) | only after nothing reads intent tags |
| 7 | **CLEANUP** (code removal PR) | only after 5–6 stable ≥2 weeks |

Each step is independently revertible; never advance two steps in one deploy.

---

## 2. Stage gates, health metrics, rollback

### Stage 1 → SHADOW
- **Change:** `CREATOR_INTELLIGENCE_MODE=shadow` on the web app. Worker untouched.
- **Zero behavior change** — results byte-identical; only trace lines added.
- **Collect (from `searchTrace` events; see §3):**
  - `8_post_filter_ci_shadow`: `legacyPass`, `intelligencePass`,
    `recoveredByIntelligence`, `provenanceOnlyMatches`, `unresolved`, per query.
  - `coverage_ci_shadow`: per-attribute + per-platform coverage of returned pools.
- **Exit criteria (5–7 days of real traffic):**
  - shadow events observed on ≥95% of category-filtered browse calls;
  - browse p95 latency delta < 5% vs pre-shadow baseline;
  - zero new error-rate change on the 19 gated endpoints.
- **Rollback:** unset the flag. Nothing else to undo.

### Stage 3 → Backfill gate
- Run `npm run backfill:creator-intelligence`; script prints per-page and final
  category coverage.
- **Gate:** categories coverage **≥80% on each target platform** (per
  `coverage_ci_shadow.byPlatform`) AND shadow shows
  `recoveredByIntelligence ≥ provenanceOnlyMatches` (CI must not lose more than
  it gains). If coverage is low → enrichment spend first (respect
  `costProtection` caps); do NOT proceed to ON on hope.

### Stage 4 → ON
- **Change:** `CREATOR_INTELLIGENCE_MODE=on` on the web app.
- **Behavior change (bounded):** category post-filter = CI ∪ legacy (union —
  result sets can only grow), ranking orders by resolved intelligence, rerank
  prompts use resolved intelligence.
- **Health metrics + alert thresholds (first 48h, then weekly):**
  - `8_post_filter` drop with `ciMode:"on"`: post-filter survivor count must be
    ≥ legacy baseline for the same filters (union guarantees this; alert on ANY
    shrink — it means a code defect);
  - zero-result rate for category-filtered searches: must not increase >2%
    absolute;
  - slate proposal block rate (`slateProposalStatus=blocked`): must not increase;
  - browse p95 latency delta < 10%;
  - `coverage_ci_shadow.categories.coverage` trending up as enrichment lands.
- **Rollback:** set flag back to `shadow` (keeps telemetry) or `off`. Single env
  change, no data to revert.

### Stage 5 → Predicate flip (separate deploy, own runbook entry)
- Repoint `searchDiscoveredProfiles` + `browse_influencer_ids_for_categories`
  at `creator_intelligence` (new RPC/migration; keep old code path behind the
  same flag pattern).
- **Gate:** projection freshness — `max(updated_at)` lag < 24h; row count ≥
  distinct active creators; spot-check 20 known creators' categories.
- **Health:** result-count parity sampling (old vs new predicate on identical
  filters, logged for 100% of queries for 48h, then 1% sampling); alert on
  >5% median result-count divergence.
- **Rollback:** revert the deploy (old predicate path still in code).

### Stage 6 → Intent-tag write off
- `DISCOVERY_WRITE_INTENT_TAGS=false` on the **worker** env.
- **Gate:** Stages 4–5 stable ≥2 weeks; confirmed zero readers of intent tags
  (only the legacy paths removed in Stage 7 still reference them, behind off
  branches).
- **Rollback:** unset (writes resume; no data loss — tags were provenance).

### Stage 7 → CLEANUP (code PR, no flag)
Remove, in one reviewed PR (each item is provably dead once 4–6 hold):
`creatorMatchesBrowseCategories` + `categoryTagMatchesFilter` (legacy matcher),
`applyCategoriesToArrayColumnQuery` + both `category_tags` predicates in
`search.ts`, legacy branches in `unified-ranking.categoryMatchScore` /
`campaign-relevance-scoring.evaluateCategory` / `campaign-fit-rerank`
summaries, `lib/creator-intelligence/shadow.ts` + `flags.ts` (flag dies),
worker intent-tag write + its flag, `8_post_filter_ci_shadow` /
`coverage_ci_shadow` emitters. **Product-decision items (not automatic):**
converge `lib/discovery/campaign-match.ts`, `lib/creators/campaign-match.ts`,
`ai-candidate-pool` onto the Matching Engine; migrate `creator-detail-sheet`
and `shortlist-document` to render resolved intelligence; fix the
`linkedin→twitter` platform coercion in `campaign-search-intent`.

---

## 3. Monitoring & dashboards

Telemetry source: `searchTrace` events (enable `AI_SEARCH_TRACE=1` on one
canary instance, or route `searchTrace` to the log drain in prod config).
Events already emitted by code:

| Event | Fields | Dashboard panel |
|---|---|---|
| `8_post_filter` (`ciMode`) | before/after counts per filter | "CI adoption": % of category-filtered browses running with `ciMode=on` |
| `8_post_filter_ci_shadow` | legacy/CI pass, recovered, provenance-only, unresolved | "Migration delta": recovered vs lost, unresolved trend |
| `coverage_ci_shadow` | per-attribute + per-platform coverage | "Enrichment coverage": gate progress toward 80% |
| `discovery_coverage_decisions` table | db count, coverage, acquisition | "Acquisition honesty": acquisitions triggered on genuine gaps vs false insufficiency |
| `discovery_jobs` statuses | pending/running/completed/failed | "Queue health": pending-age p95 (BullMQ fix regression watch) |

Four dashboard rows: **Adoption** (Q1 metric), **Quality** (zero-result rate,
slate block rate, recovered/lost), **Coverage** (per-platform), **Infra**
(browse p95, queue pending-age, worker heartbeat).

---

## 4. Validation checklists

**Pre-deploy (every stage):** `tsc --noEmit` zero new errors ·
`npm run test:creator-intelligence` · `test:bullmq-connection` ·
`test:creator-search-parser` · relevance/rank-browse/fit-rerank suites ·
`npm run trace:discovery -- <known conversation>` reaches FINAL verdict.

**Post-deploy smoke (every stage):** one Discovery category search returns
creators; one Studio campaign brief produces Vendor Recommendations; one
shortlist export renders; `discovery_jobs` pending-age < 10 min.

**Stage-specific:** SHADOW → shadow events visible in logs within 1h.
ON → union assertion: pick 3 known category searches, result count ≥ legacy
count from shadow week. FLIP → parity sampling green 48h. CLEANUP → full
regression suite + one week soak at previous stage first.

---

## 5. Flag end-state

| Flag | After Stage 7 |
|---|---|
| `CREATOR_INTELLIGENCE_MODE` | **deleted** (CI is the only path) |
| `DISCOVERY_WRITE_INTENT_TAGS` | **deleted** (writes removed) |
| `AI_SEARCH_TRACE` / `AI_WORKFLOW_TRACE` | permanent (diagnostics) |
| `DISCOVERY_*` worker tuning, `REDIS_URL`, cost-protection settings | permanent (ops) |
