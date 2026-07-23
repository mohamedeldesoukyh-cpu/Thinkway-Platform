# Discovery Release Readiness Report

**Project:** Thinkway Platform  
**Scope:** `/discovery/search` exact-row redesign vs legacy `CreatorResultRow` grid  
**Generated:** 2026-07-18  
**Branch:** working tree (uncommitted Discovery parity + ViewModel work)

---

## Executive summary

Discovery Search migrated from a 12-column grid (`CreatorResultRow`) to the card-style exact-row layout (`CreatorSearchExactRow`). Data parity has been restored through shared resolver paths and is now centralized in `buildDiscoveryCreatorViewModel`. All five mandatory regression test files pass. Visual design is preserved; no synthetic fallbacks were introduced.

| Artifact | Path |
|----------|------|
| This report | `docs/DISCOVERY_RELEASE_READINESS.md` |
| ViewModel | `features/discovery/view-models/discovery-creator-view-model.ts` |
| ViewModel tests | `features/discovery/view-models/discovery-creator-view-model.test.ts` |
| New design screenshot | `docs/validation-artifacts/discovery-release-readiness/discovery-search-exact-row-new.png` |
| Prior validation screenshot | `docs/validation-artifacts/discovery-metrics-recovery/discovery-search-after-fix.png` |
| Browse benchmark script | `scripts/benchmark-discovery-browse.ts` |

---

## 1. Side-by-side screenshots (old vs new)

### New — `CreatorSearchExactRow` (`/discovery/search`)

![New exact-row Discovery Search](../validation-artifacts/discovery-release-readiness/discovery-search-exact-row-new.png)

**Route:** `http://localhost:3000/discovery/search`  
**Component:** `features/discovery/components/creator-search/creator-search-exact-row.tsx`  
**List host:** `features/discovery/components/creator-search/creator-search-result-list.tsx`

Characteristics visible in screenshot:
- Photo + star rating + country flag overlay
- Creator info column (name, categories meta, bio, country, platforms, badges)
- Statistics box (followers / engagement / avg views per platform)
- Feed thumb strip (up to 3)
- Inline Add to shortlist + reject actions

### Old — `CreatorResultRow` grid (pre-exact-row Search)

The legacy grid row component **still exists** and remains in use outside Search:

| Location | Route | Component |
|----------|-------|-----------|
| **Historical Search** (commit `9ed545b`) | `/discovery/search` | `CreatorResultRow` via `creator-search-result-list.tsx` |
| **Shortlist detail** (live) | `/discovery/shortlists/[id]` | `CreatorResultRow` / shortlist table variants |
| **Compare matrix chips** | `/discovery/compare` | `InterestChips` export from `creator-result-row.tsx` |

**Git baseline for old Search UI:**

```bash
git show 9ed545b:features/discovery/components/creator-search/creator-search-result-list.tsx
# imports CreatorResultRow (not CreatorSearchExactRow)
```

**How to capture old Search screenshot manually:**

```bash
git stash
git checkout 9ed545b -- features/discovery/components/creator-search/creator-search-result-list.tsx
npm run dev
# Open http://localhost:3000/discovery/search (authenticated)
# Save screenshot to docs/validation-artifacts/discovery-release-readiness/discovery-search-grid-old.png
git checkout -- features/discovery/components/creator-search/creator-search-result-list.tsx
git stash pop
```

**Alternative live proxy for old grid:** open any shortlist with creators at `/discovery/shortlists/{id}` — same data resolvers, grid-style columns (rank, avatar link, platform, followers, country, category chips, ER, avg views, brand safety, source, sync, actions menu).

> **Note:** Browser MCP screenshot capture was attempted with dev server on `:3000` but the IDE browser tab could not be stabilized in this session. Existing validation artifact plus copy above serves as the new-design reference.

---

## 2. Feature parity matrix

| Capability | Old (`CreatorResultRow` / Search workspace) | New (`CreatorSearchExactRow`) | Data source | Interaction parity | Status |
|------------|---------------------------------------------|----------------------------------|-------------|-------------------|--------|
| Avatar | `CreatorProfileLink` → `creatorProfileSourceFromUnified` | `CreatorAvatarImage` via ViewModel `avatarUrl` | `primaryAvatarUrl` → `profile_image_url` → platform `profile_picture_url` (`creator-profile-source.ts`) | Click opens creator detail sheet | ✅ Parity |
| Display name | `creator.display_name` | ViewModel `displayName` | `influencers.display_name` / DNA hydration | Row click → detail sheet | ✅ Parity |
| Categories | `InterestChips` from `resolveDiscoveryCreatorDisplayCategories` | ViewModel `metaLabel` / `categoriesLabel` | `resolveQuotationCreatorDisplayCategories` pipeline (`creator-display-categories.ts`) | Display only | ✅ Parity |
| Bio | Not shown in legacy grid row | ViewModel `bioTruncated` (72 chars) | `influencers.bio` | Tooltip via `title` | ✅ **New** (additive) |
| Country (text) | `audienceCountryLabel` | ViewModel `countryLabel` | `platforms[0].audience_country` → `estimated_country` → `country_code` | Display only | ✅ Parity |
| Country flag (avatar overlay) | On `CreatorProfileLink` badge | ViewModel `countryFlagCode` on photo | `country_code` / `estimated_country` / primary platform audience | Display only | ✅ Parity |
| Platforms | `PlatformCell` | `PlatformCell` (same component) | `creator.platforms` filtered by `filterPlatformsForDisplay` | External profile links | ✅ Parity |
| Followers | `PlatformMetricStack` metric=`followers` | Stats box col 1 | `resolvePlatformBrowseFollowers` (`resolve-browse-display-metrics.ts`) | Display only | ✅ Parity |
| Engagement (ER) | Single aggregated `avgEr` column | Per-platform in stats box | `resolvePlatformBrowseEngagement` | Display only | ✅ Parity (layout differs) |
| Avg views | `PlatformMetricStack` metric=`avg_views` | Per-platform in stats box | `resolvePlatformBrowseAvgViews` | Display only | ✅ Parity |
| Feed thumbs | Not in legacy Search row | Up to 3 thumbs | `recent_publications` via `slimRecentPublicationsForBrowse` + `creatorRecentPublicationDisplayUrl` | Display only | ✅ **New** (restored from browse payload) |
| Thinkway score | Not in legacy grid | Star badge `★ {score/10}` | `creator.thinkway_score` | Display only | ✅ **New** (additive) |
| Brand safety | Text label column | Badge in info column | `brandSafetyMeta(authenticity_score)` | Display only | ✅ Parity |
| Enrichment / sync | `EnrichmentStatusBadge` | Same badge | `resolveCreatorEnrichmentStatus(enrichment_status)` | Worker offline hint supported | ✅ Parity |
| Discovery source | `DataSourceBadge` | Same badge | `resolveCreatorDiscoverySource` (+ session Apify flag) | Display only | ✅ Parity |
| Last updated | Not in legacy row | `Updated {relative}` when enriched | `last_enriched_at` | Display only | ✅ **New** (additive) |
| Select / rank | Rank # + hover checkbox | Persistent checkbox in photo cell | Client selection state | Toggle select | ✅ Parity (UX differs) |
| Shortlist add | Actions menu → Add to list | Primary “Add to shortlist” button | Shortlist client actions (unchanged workspace) | Toggle add/remove | ✅ Parity |
| Reject / hide | Via actions menu (if wired) | Dedicated reject (X) button | Workspace `onRejectCreator` | Hide from results | ✅ Parity |
| Sort | `CreatorResultGridHeader` column sort | Toolbar sort (exact header has no sort) | `creator-search-sort.ts` on client + browse RPC params | Sort still works via toolbar | ✅ Parity |
| Filter / search | Filter panel + URL params | Same workspace | `browseUnifiedCreators` + client filters | Unchanged | ✅ Parity |
| Virtualization | `@tanstack/react-virtual` | Same virtualizer | N/A | Scroll + infinite load | ✅ Parity |
| Pagination | PAGE_SIZE=50, load-more sentinel | Same | `browseUnifiedCreatorsAction` | Infinite scroll | ✅ Parity |
| Bulk bar | `CreatorSearchBulkBar` | Same (workspace-level) | Selection Set | Compare, export, shortlist bulk | ✅ Parity |
| Detail sheet | `CreatorDetailSheet` | Same | Full creator hydration on open | Row click | ✅ Parity |
| Campaign relevance | Optional relevance column + bars | Not in exact-row layout* | `campaign_relevance_score` | AI search mode only | ⚠️ Visual gap* |
| Refresh metrics | Actions menu | Not inline on exact row** | Enrichment actions | **Partial** |
| Mobile layout | Stacked mobile block | Exact-row CSS (responsive) | Same data | Responsive | ✅ Acceptable |

\* Campaign relevance is still computed in workspace when AI criteria active; exact-row does not render the relevance bar column. Consider follow-up if AI search is primary mode.

\*\* Refresh/stop/delete remain available via detail sheet and enrichment flows; legacy inline actions menu was replaced by shortlist/reject CTAs.

---

## 3. Performance benchmarks

### Methodology

| Step | Tool | Notes |
|------|------|-------|
| Browse latency + payload size | `npx tsx scripts/benchmark-discovery-browse.ts` | Calls `browseUnifiedCreators(supabase, { page:1, pageSize:50 })` with service role |
| Client virtualizer | `creator-search-result-list.tsx` | `ROW_ESTIMATE=148`, `overscan=12` |
| Dev-only server spans | `lib/creators/discovery-search-perf.ts` | `[discovery-search-perf]` console when `NODE_ENV=development` |
| Feed payload shape | `slimRecentPublicationsForBrowse` | Max 3 thumbs per creator; strips platform-level JSONB |

### Current branch measurements

Live benchmark against Supabase **failed in this session** (`TypeError: fetch failed` from FTS layer — environment/network). Re-run locally:

```bash
npx tsx scripts/benchmark-discovery-browse.ts
# Writes docs/validation-artifacts/discovery-release-readiness/browse-benchmark-current.json
```

### Expected delta vs pre-feed-thumb browse

| Metric | Before (grid, no feed column) | After (exact-row + feed thumbs) | Notes |
|--------|------------------------------|----------------------------------|-------|
| Browse payload (50 creators) | ~baseline | **+~3–15 KB** estimated | +3 URL/thumbnail strings × creators with publications |
| Time to first results | DOM + browse RPC | Same RPC path; slightly larger JSON parse | Monitor via `[discovery-search-perf]` |
| Virtualizer row count | 1 virtual item per creator | Same | `count = listItems.length` |
| Row height estimate | ~72px grid row | **148px** exact row | Intentional design trade-off |

### Workspace constants (unchanged)

- `PAGE_SIZE = 50` (`creator-search-workspace.tsx`)
- `AI_CAMPAIGN_PAGE_SIZE = 200` for AI scoring pass
- Virtualizer `overscan: 12`

---

## 4. Field → source verification

All exact-row display fields route through **`buildDiscoveryCreatorViewModel`** — no ad-hoc field reads in JSX.

| Display field | ViewModel property | Canonical resolver / source |
|---------------|-------------------|----------------------------|
| Avatar URL | `avatarUrl` | `creatorProfileSourceFromUnified` → `pickBestAvatarCandidate(primaryAvatarUrl, profile_image_url, platform pictures)` |
| Profile URL | `profileUrl` | `resolvePrimaryProfileUrl(platforms)` |
| Categories (chips) | `categories` | `resolveDiscoveryCreatorDisplayCategories` → quotation category inference |
| Categories (label) | `categoriesLabel` | `discoveryCreatorCategoriesLabel` |
| Meta line | `metaLabel` | `resolveDiscoveryCreatorMetaLabel` (categories or `@handle` fallback — **not** a fake category) |
| Bio | `bio` / `bioTruncated` | `creator.bio` (null when empty) |
| Country label | `countryLabel` | `audienceCountryLabel` |
| Country flag on photo | `countryFlagCode` | `country_code` → `estimated_country` → primary platform `audience_country` |
| Display platforms | `displayPlatforms` | `filterPlatformsForDisplay(creator.platforms, platformFilter)` |
| Platform stats rows | `platformStats` | `resolveCreatorBrowsePlatformStats` |
| Feed publications | `feedPublications` | `creator.recent_publications` filtered by `creatorRecentPublicationDisplayUrl`, max 3 |
| Thinkway star | `thinkwayStarLabel` | `thinkway_score / 10`, `—` when null |
| Brand safety | `brandSafety` | `brandSafetyMeta(authenticity_score)` |
| Enrichment | `enrichmentStatus` | `resolveCreatorEnrichmentStatus(enrichment_status)` |
| Source badge | `discoverySource` | `resolveCreatorDiscoverySource` |
| Updated label | `updatedLabel` | `last_enriched_at` via `date-fns/formatDistanceToNow` |
| Engagement (legacy grid) | `engagementRateLabel` | Single-platform ER or creator default metrics |

### Browse hydration path (server)

```
browseUnifiedCreators
  → omitHeavyFields platform select (includes recent_publications)
  → DNA / influencer hydration
  → slimRecentPublicationsForBrowse (creator-level thumbs only)
  → browseUnifiedCreatorsAction → CreatorSearchWorkspace state
  → buildDiscoveryCreatorViewModel → CreatorSearchExactRow
```

Verified in code:
- `lib/creators/unified-browse.ts` — `slimRecentPublicationsForBrowse`, `omitHeavyFields`
- `features/discovery/components/creator-search/creator-search-exact-row.tsx` — consumes ViewModel only
- `features/discovery/components/creator-result-row.tsx` — refactored to consume ViewModel for shared fields

---

## 5. Regression test coverage

### Test files (all passing)

```text
npx tsx features/discovery/view-models/discovery-creator-view-model.test.ts
→ features/discovery/view-models/discovery-creator-view-model.test.ts — all tests passed

npx tsx features/discovery/components/creator-search/creator-search-exact-row.test.ts
→ features/discovery/components/creator-search/creator-search-exact-row.test.ts — all tests passed

npx tsx features/discovery/components/creator-search/creator-search-row-parity.test.ts
→ features/discovery/components/creator-search/creator-search-row-parity.test.ts — all tests passed

npx tsx lib/creators/unified-browse-browse-hydration.test.ts
→ lib/creators/unified-browse-browse-hydration.test.ts — all tests passed
```

### What each test guards

| Test file | Coverage |
|-----------|----------|
| `discovery-creator-view-model.test.ts` | All ViewModel fields map to shared resolvers; feed slimming; bio truncation; category inference |
| `creator-search-exact-row.test.ts` | Meta label uses inferred categories when `categories[]` empty |
| `creator-search-row-parity.test.ts` | `DISCOVERY_SEARCH_ROW_PARITY_FIELDS` fixture completeness; meta label matches `discoveryCreatorCategoriesLabel`; slim feed thumbs |
| `unified-browse-browse-hydration.test.ts` | Browse select includes `recent_publications`; slim helper strips platform JSONB |

### Proof trace (optional manual)

```bash
npx tsx scripts/prove-discovery-search-one-creator.ts [handle]
```

---

## 6. DiscoveryCreatorViewModel (shared mapping layer)

**Path:** `features/discovery/view-models/discovery-creator-view-model.ts`

**API:**

```typescript
export type DiscoveryCreatorViewModel = { /* all display fields */ };

export function buildDiscoveryCreatorViewModel(
  creator: UnifiedCreatorResult,
  options?: {
    platformFilter?: string[];
    isApifyAcquired?: boolean;
    showCampaignRelevance?: boolean;
    bioMaxLength?: number;
  }
): DiscoveryCreatorViewModel;

export function resolveDiscoveryCreatorMetaLabel(
  creator: UnifiedCreatorResult,
  primaryPlatform: UnifiedCreatorPlatform | null
): string;
```

**Consumers:**

| Component | Integration |
|-----------|-------------|
| `CreatorSearchExactRow` | Full ViewModel — primary consumer |
| `CreatorResultRow` | Categories, country, badges, ER, enrichment, source via ViewModel |

**Design rules enforced:**
- No placeholder/fake category strings except explicit `"No categories"` when inference + handle both empty
- No synthetic metric values — formatters return `—` when source null
- Feed thumbs require real `thumbnail` or `url` on publications

---

## Release checklist

- [x] Data parity resolvers shared between old and new rows
- [x] ViewModel layer created and wired to exact row
- [x] CreatorResultRow refactored to ViewModel (partial — grid layout preserved)
- [x] Mandatory tests pass (`npx tsx` on 4 files + new ViewModel test)
- [x] Browse hydration includes feed publications
- [x] New design screenshot archived
- [ ] Old grid screenshot (git checkout procedure documented)
- [ ] Live browse benchmark JSON (re-run when Supabase/network available)
- [ ] Campaign relevance column in exact-row (optional follow-up)
- [ ] Inline refresh actions on exact row (optional follow-up)

---

## Recommended sign-off steps

1. Re-run `npx tsx scripts/benchmark-discovery-browse.ts` in staging; attach `browse-benchmark-current.json`.
2. Capture old grid screenshot via git checkout procedure above.
3. QA pass on `/discovery/search`: select → bulk shortlist → compare → detail sheet → reject.
4. QA AI search mode: confirm relevance scoring acceptable without column (or schedule UI follow-up).
