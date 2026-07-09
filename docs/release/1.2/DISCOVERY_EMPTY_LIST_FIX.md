# Discovery Empty List Fix (C18 / Release 1.2)

**Date:** 2026-07-05  
**Brief:** C18 — Baby Joy (UAE mom/parenting creators, Instagram + TikTok)

---

## Root cause

The Discovery UI returned an **empty creator list** on an empty or sparse DB because the **database-first → Apify backfill pipeline was wired only on the AI progressive search path**, not on Discovery browse.

| Layer | Before fix | After fix |
|-------|------------|-----------|
| `/discovery` UI | `browseUnifiedCreatorsAction` → `browseUnifiedCreators(path="discovery")` | Same entry, now via `browseUnifiedCreatorsWithCoverageBackfill` |
| Coverage evaluation | Only when `tracePath === "ai"` | Also when `tracePath === "discovery"` |
| Apify / worker backfill | Only `executeProgressiveCreatorSearch` (AI) | Discovery browse on page 1 with search intent |
| Audit (`discovery_coverage_decisions`) | AI progressive search only | Discovery browse (page 1 + intent) |
| Re-query after backfill | Never (async enqueue only) | Poll job up to 45s, then re-browse DB |
| UI feedback | Empty state only | Status banner + auto re-fetch if job still running |

**Broken entry point:** Discovery UI → `features/campaigns/creator-discovery-actions.ts` → `browseUnifiedCreators(..., "discovery")` with no coverage gate and no backfill.

**Not the primary issue:** Worker itself — backfill jobs were never enqueued from Discovery browse. If Redis/worker are down, enqueue fails and audit records `db_insufficient_apify_skipped`.

---

## Required flow (now implemented)

```
User search (/discovery)
  → browseUnifiedCreators (DB)
  → evaluateDiscoveryCoverage
  → if insufficient AND page=1 AND has intent (search/country/category/platform):
       enqueue discovery-worker job (location or hashtag)
       wait for job (DISCOVERY_COVERAGE_BACKFILL_WAIT_MS, default 45s)
       re-query browseUnifiedCreators
  → write discovery_coverage_decisions
  → return ranked creators + backfill meta to UI
```

Worker path (unchanged): crawl → upsert `discovered_profiles` → enrichment/DNA on subsequent pipelines.

---

## Files changed

| File | Change |
|------|--------|
| `lib/creators/unified-browse.ts` | Coverage + ranking on `discovery` path |
| `lib/discovery/coverage-backfill.ts` | Browse-filter payload, job wait poll, `jobId` return |
| `lib/discovery/coverage-backfill-orchestrator.ts` | **New** — orchestrate browse → backfill → re-query → audit |
| `features/campaigns/creator-discovery-actions.ts` | Use orchestrator for Discovery browse |
| `features/discovery/components/creator-search/creator-search-types.ts` | Pass `coverageIntent` from UI filters |
| `features/discovery/components/creator-search/creator-search-workspace.tsx` | Backfill status banner + delayed re-fetch |
| `lib/domains/creator/types.ts` | `backfill` on browse result |
| `lib/discovery/types.ts` | `DiscoveryBrowseBackfillMeta` type |

**Frozen (untouched):** Campaign Director, Debate, CampaignFacts, Governance, Studio, Decision Workspace.

---

## How to test with C18 (Baby Joy)

### Brief signals (from C18.pdf)

- **Brand:** Baby Joy — baby care / diapers  
- **Geo:** UAE (`AE`)  
- **Audience:** moms, parenting, 0–3 years  
- **Platforms:** Instagram, TikTok  
- **Categories:** Parenting, Motherhood, Family, Baby, Lifestyle  

### Discovery UI

1. Start Redis + discovery worker:
   ```bash
   npm run discovery:worker:dev
   ```
2. Open `/discovery`.
3. Set filters aligned with C18:
   - **Country:** UAE (`AE`)
   - **Categories:** Parenting, Motherhood (or Family)
   - **Platforms:** Instagram (and/or TikTok)
   - **Search:** `baby mom parenting UAE`
4. **Empty DB scenario:** With no matching creators in DB, first load should:
   - Show loading longer (backfill wait, up to ~45s)
   - Enqueue `discovery:coverage_backfill:location` (country = AE)
   - After worker completes, list should populate (or status banner + auto re-fetch)
5. **Repeat search:** Same query should hit DB only (no Apify) if coverage ≥ threshold.
6. **Audit:** Row in `discovery_coverage_decisions` with `search_query.mode = "discovery"`.

### Without Apify / worker (mock path)

- Set `DISCOVERY_COVERAGE_APIFY_FALLBACK=false` → DB-only, audit `db_insufficient_apify_skipped`.
- Or omit `REDIS_URL` → same skip reason in UI banner.
- Worker with `ALLOW_MOCK_SEED=true` (worker config) can seed profiles when crawl returns zero.

### AI path (regression)

- Progressive search still enqueues on insufficient coverage; unchanged behavior except `jobId` now returned from backfill helper.

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `DISCOVERY_COVERAGE_APIFY_FALLBACK` | enabled | Gate Apify/worker backfill |
| `RELEASE_12_DB_FIRST` | enabled | Master DB-first flag |
| `DISCOVERY_COVERAGE_BACKFILL_WAIT_MS` | `45000` | Max wait before returning partial + UI poll |
| `REDIS_URL` | — | Required to enqueue worker jobs |

---

## Validation commands

```bash
node scripts/validate-database-first-discovery.mjs
npm run build
npx tsc --noEmit
```

---

## Known limits

- Backfill uses discovery-worker **location/hashtag crawl**, not dedicated Apify search actors.
- DNA enrichment for new profiles may lag; browse shows discovered profiles once worker upserts them.
- Unfiltered browse (no search/country/category) does **not** trigger backfill (avoids global crawl).
- Pagination (page > 1) does not re-trigger backfill.
