# Discovery Browse Performance (Phase 1)

## Problem

Unfiltered Discovery browse (`queryBrowsableInfluencerIdsByRecency`) previously:

1. Scanned **all** `discovered_profiles` for linked influencer IDs.
2. Loaded **all** active influencer recency rows (and linked prospects) into Node.
3. Sorted in memory, then sliced one page.

Cost scaled with catalog size on every browse request (including Egypt pin pool + main pool fetches).

## Fix

### SQL RPC: `browse_influencer_ids_by_recency`

Migration: `supabase/migrations/20260721120000_browse_influencer_ids_by_recency.sql`

- Filters active influencers + discovery-linked prospects in SQL.
- Applies country / language filters in SQL (same semantics as PostgREST helpers).
- Orders by **ID-stage pin tier** (enrichment + recency only — platforms not available yet), then `coalesce(last_enriched_at, updated_at) DESC`, score, id.
- Returns **only** `LIMIT/OFFSET` rows plus `total_count` via window function.

App path: `lib/creators/discovery-browse-pool.ts` → RPC first, legacy full-catalog fallback if RPC missing.

### Slim browse hydration

`fetchInternalCreators(..., { omitHeavyFields: true })` now:

- Selects `recent_publications` for Search feed thumbs, then `slimRecentPublicationsForBrowse` keeps ≤3 creator-level display rows (url/thumbnail/isVideo only) and strips platform JSONB.
- Omits contact fields, bio/hashtags/mentions from platform account SELECT.
- Omits rate card, payment, demographics columns from influencer SELECT.
- Loads DNA once via `hydrateCreatorsWithDna` (skips the pre-map DNA fetch).

### Audience-filter scan

`browseDiscoveryAudienceFilteredPage` no longer continues scanning the full catalog after the requested page is filled solely to compute an exact filtered total.

| Condition | `total` | `has_more` |
|-----------|---------|------------|
| Raw pool exhausted during page-fill scan | Exact filtered count | Based on window |
| Raw pool not exhausted | Lower-bound (≥ page end) | `true` |

Page **membership and ranking** for the requested page are unchanged (same fill + sort). Only the total badge can be a lower bound when more raw pages remain.

## Ranking / UX preservation

| Layer | Behavior |
|-------|----------|
| ID selection (RPC) | Matches prior ID-stage JS sort (no platforms → no multi-platform tiers 0–1). |
| Post-hydration | `sortBrowseCreatorsInDefaultOrder` still applies full Egypt / multi-platform pin tiers. |
| Egypt pin pool | Still fetched on page 1 when no country filter. |
| Category browse | Unchanged (`browse_influencer_ids_for_categories`). |
| Search / FTS | Unchanged. |
| Creator Intelligence category modes | Unchanged (`applyPostBrowseFilters`). |

### Documented minor differences (not regressions of product rules)

1. **Within-day ID order** — RPC uses timestamp DESC; prior day-bucket compare then timestamp. Relative order across days is preserved; within the same calendar day, order may refine.
2. **Audience filter totals** — may be a lower bound when the scan stops early (see above). Results on the current page are unchanged.
3. **Browse card payload** — list hydration keeps ≤3 slim feed thumbs; detail sheets that refetch by id still use full hydration.

## Measurement

```bash
# Requires applied migration + Supabase env (service or user with discovery.read)
npm run measure:discovery-browse-pool
```

Reports RPC vs legacy wall time, ID count, total, and approximate row payload for a sample page.

### Baseline (before RPC — measured 2026-07-21 on linked project)

Unfiltered browse ID page (`page=1`, `pageSize=120`), catalog **6,788** influencers:

| Path | Wall time | IDs returned | `total` | JSON payload |
|------|----------:|-------------:|--------:|-------------:|
| Legacy full-catalog materialization | **~2.0–4.1 s** | 120 | 6788 | ~4.7 KB |

Memory proxy: legacy path builds an in-memory set of **all 6,788** recency rows before slicing.

### After RPC (applied on linked project `thinkway-dev`, 2026-07-21)

Migration `20260721120000_browse_influencer_ids_by_recency` applied via `npx supabase db push`.

`npm run measure:discovery-browse-pool` (`page=1`, `pageSize=120`, catalog **6,788**):

| Path | Wall time | IDs | `total` | Payload | `source` |
|------|----------:|----:|--------:|--------:|----------|
| **RPC** (`browse_influencer_ids_by_recency`) | **~308–680 ms** (warm **~92–102 ms**) | 120 | 6788 | ~4.7 KB | **`rpc`** |
| Legacy full-catalog (comparison only) | ~2100–2500 ms | 120 | 6788 | ~4.7 KB | `legacy` |

**Speedup:** ~**3.7–6.8×** vs legacy on the same page (warm RPC samples ~**100 ms** via service role). App path `queryBrowsableInfluencerIdsByRecency` returns `source: "rpc"` — legacy is no longer used for default browse.

Note: First call after deploy may be slower (schema cache / connection). ID-stage timing only — creator card hydration is a separate step after IDs return.

## Apply migration

```bash
# Local / linked project
npx supabase db push
# or apply the SQL file in the Supabase SQL editor
```

Until the migration is applied, the app falls back to the legacy path and logs a warning in development.
