# Creator Search Filter Truth Matrix (Phase 0)

**Status:** Phase 0 contract — trustworthy filters over feature count  
**Code SSOT:** `lib/creators/creator-search-filter-truth.ts`  
**Engine:** `browseUnifiedCreators` / `discovery-browse-filters` / `creator-last-post-filter`

## Classification

| Class | Meaning |
|-------|---------|
| **ENFORCED** | Applied correctly on server retrieval / post-browse |
| **ENFORCED_WITH_REQUIRED_DATA** | Enforced when required fields are hydrated for the request |
| **UNSUPPORTED** | Cannot enforce correctly (must not look active) |
| **UI_DISABLED** | Intentionally unavailable in the UI |

**Composition:** AND across filter dimensions. OR within platforms, categories, countries, and languages.

## Matrix

| Filter | UI state | Canonical data source | Server/client | Phase 0 behavior | Known limitation | Phase 1 dependency | Test coverage |
|--------|----------|----------------------|---------------|------------------|------------------|--------------------|---------------|
| search (`q`) | active | `search_creators` FTS + identity fields | server | Lexical tiers | No Arabic morphology | — | intent + FTS suites |
| handle chip | approximate | FTS concat + primary handle | server+client | Substring on `platforms[0]` | Multi-platform handles | Unify handle server-side | `creator-search-filter-truth.test.ts` |
| platforms | active | `influencer_platform_accounts.platform` | server | OR within; 1→SQL, 2+→post | Multi-platform page underfill | ID-stage multi-platform | truth matrix test |
| categories | active | `influencers.categories` | server | OR within | CI mode union when on | — | truth matrix test |
| countries | active | `country_code` / `country_codes` | server | OR within; first→SQL | Multi-country underfill | ID-stage multi-country | truth matrix test |
| languages | active | `influencers.languages` → `language_codes` | server | Hydrated when filter set; missing ≠ match | Sparse language rows exclude | — | truth matrix test |
| contentLanguages | active | same `language_codes` | server | Same field until content-lang SSOT | Not caption/content corpus | Dedicated content language | truth matrix test |
| audienceCountries | active | demos / platform audience / creator fallback | server | OR | Fallback to creator country | Audience graph | browse-filters tests |
| audience gender | active | `audience_gender_*` | server | Hydrate only when set; missing excludes; **normal page path** (not catalog scan) | Sparse demos → underfilled pages / empty page | Phase 1 page-fill | truth matrix test |
| audience age | active | `audience_age_*` | server | Hydrate only when set; missing excludes; normal page path | Sparse demos → underfilled pages | Phase 1 page-fill | truth matrix test |
| audience interests | active | categories / niche / interests | server | OR substring | Loose match | — | browse-filters tests |
| min/max followers | active | `follower_count` | server | Account prefilter | — | — | existing |
| min engagement | active | `engagement_rate` | server | Account prefilter | Unit consistency | — | existing |
| min views | active | `avg_views` | server | Prefilter + post-filter; null excludes | Sparse views shrink results | — | truth matrix test |
| min Thinkway | active | `thinkway_score` | server | Post-filter | Not ECI | — | existing |
| last post within | active | `recent_publications[].posted_at` | server | Project `posted_at` when set; missing excludes; never `last_enriched_at` | Only first 3 pubs projected | Page-fill for freshness | truth matrix test |
| pricing | **disabled** | `rate_card` (unstructured) | none | UI disabled; no chips | Not Search-indexed | Commercial rate index | truth matrix + UI |
| verification | **disabled** | `is_verified` | none | Coming soon control | — | Product enablement | UI |
| aiNiche / brand safety | approximate | `ai_niche` / authenticity / brand_fit | **client** | Still client-only | Pagination approximate | Server + page-fill | truth matrix test |

## Hydration extras (unfiltered remains slim)

| Filter active | Extra columns |
|---------------|---------------|
| languages / contentLanguages | `influencers.languages` |
| gender / age | demographic share columns |
| lastPostWithin | `recent_publications[0..2].posted_at` scalars |

Unfiltered browse does **not** fetch demographics, languages, rates, full publications JSONB, DNA, or ECI.

## Deferred to Phase 1

1. Multi-platform / multi-country ID-stage SQL (page fill under OR filters)
2. Server-side handle / aiNiche / brandSafety + page-fill architecture
3. Exact totals when post-filters shrink pages
4. Normalized pricing index

## Pagination honesty (Phase 0)

When remaining client-only filters are active:

- Creator count badge uses lower-bound `N+` semantics
- Empty filtered load-more pages stop `has_more` (no infinite empty scroll)

Full page-fill is Phase 1.
