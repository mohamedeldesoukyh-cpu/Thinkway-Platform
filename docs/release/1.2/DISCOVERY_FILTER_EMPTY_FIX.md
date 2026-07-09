# Discovery Filter Empty List Fix (Release 1.2)

**Date:** 2026-07-05  
**Route:** `/discovery/search`  
**Symptom:** Header shows `0 loaded · 5,120 matched` while the list reads *No creators match your filters*.

---

## Root cause

Discovery audience filter chips were **applied only on the client** after browse, while the **matched count came from the server** using a different (broader) filter set.

| Signal | Server browse (`filtersToBrowseParams`) | Client (`applyCreatorSearchClientFilters`) |
|--------|----------------------------------------|---------------------------------------------|
| Audience country (UAE) | Not sent | Strict filter on `platform.audience_country` / creator country |
| Audience interest (beauty) | Only in `coverageIntent.audience` (backfill hint) | Strict filter on categories / niche / interests |
| Gender / age | Not sent | Not applied at all (despite chips visible) |
| Matched total | SQL / FTS count of **all active creators** (~5,120) | Rows after client filter → **0** |

Flow before fix:

```
UI chips → browseUnifiedCreators (no audience filters)
         → total = 5120, creators = 50
         → applyCreatorSearchClientFilters (UAE + beauty)
         → creators = 0, total still 5120  ← contradiction
```

Gender/age chips were visible but **never wired** to browse or client predicates.

---

## Fix

1. **Shared filter module** — `lib/creators/discovery-browse-filters.ts`  
   Single predicate for audience country, interest tags, gender, age, and multi-country creator location.

2. **Wire UI → browse** — `filtersToBrowseParams` now passes:
   - `audienceCountries`
   - `audienceInterestTags`
   - `audienceGender`, `audienceAgeMin`, `audienceAgeMax`
   - `creatorCountries` (multi-select creator location)

3. **Server-side apply** — `applyPostBrowseFilters` in `unified-browse.ts` uses the shared module after DNA hydration.

4. **Accurate count + pagination** — When audience chips are active, `browseDiscoveryAudienceFilteredPage` scan-hydrates batches, applies the same filters, and sets `total` to the **filtered** count (not the raw DB total).

5. **Demographics on browse rows** — Internal hydration selects influencer demographic columns and sets `audience_demographics` for gender/age filtering (sparse-data passthrough per spec §8).

6. **Client filters** — `creator-search-client-filters.ts` delegates to the shared module; only browser-only filters remain (last post window, handle, brand safety, AI niche).

---

## Files changed

| File | Change |
|------|--------|
| `lib/creators/discovery-browse-filters.ts` | **New** — shared audience/interest/demographic predicates |
| `lib/creators/discovery-browse-filters.test.ts` | **New** — unit tests |
| `lib/domains/creator/types.ts` | Browse filter fields + `audience_demographics` on result |
| `lib/creators/unified-browse.ts` | Demographic hydration, post-filter, scan-pagination path |
| `features/discovery/components/creator-search/creator-search-types.ts` | Wire chips → browse params |
| `features/discovery/components/creator-search/creator-search-client-filters.ts` | Use shared filters; client-only extras |
| `features/discovery/components/creator-search/creator-search-workspace.tsx` | Total aligns with server filtered count |

---

## How to test (UAE + beauty + female + 25–34)

1. Open `/discovery/search`.
2. Open **Filters → Audience** and set:
   - **Audience country:** UAE (`AE`)
   - **Interest:** Beauty & cosmetics (or equivalent chip)
   - **Gender:** Female
   - **Age:** 25–34
3. Apply filters.

**Expected after fix:**

- Header **matched count equals loaded/displayed rows** (e.g. `12 loaded · 12 matched`, or `0 loaded · 0 matched`).
- No `5120 matched` with an empty list unless 5,120 rows actually pass the filters.
- Creators with enriched demographics must skew female and 25–34 to appear when gender/age chips are set.
- Creators without demographic enrichment still pass gender/age filters (sparse-data rule); country + interest filters still apply.

### Regression checks

- Clear all filters → total returns to full catalog (~5,121).
- Category chips + audience chips → count reflects both.
- `npm run build` and `npx tsc --noEmit` pass.

---

## Validation commands

```bash
node --import tsx lib/creators/discovery-browse-filters.test.ts
node features/discovery/components/creator-search/creator-search-client-filters.test.ts
npm run build
npx tsc --noEmit
```

---

## Known limits

- Audience filter scan-pagination loads creators in batches of 100 when chips are active (~5k catalog is acceptable; optimize with SQL pre-filter later).
- Gender/age require `audience_*` columns on `influencers`; creators without enrichment are not excluded by gender/age (by design).
- Interest matching is substring overlap on categories/niche/interests, not a separate taxonomy index.
