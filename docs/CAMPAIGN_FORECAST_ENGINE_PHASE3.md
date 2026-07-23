# Campaign Forecast Engine — Phase 3: Unified Forecast Data Foundation

Phase 3 introduces a **Forecast Data Foundation** beneath the existing Campaign Forecast Engine (`forecast_engine_v3`). Calculation logic is unchanged; data hydration is unified.

## Architecture

```
Database Sources
      │
      ▼
Forecast Profile Builder     lib/campaign-forecast/profile/
      │
      ▼
CreatorForecastProfile       lib/campaign-forecast/profile/types.ts
      │
      ▼
profileToForecastCreatorInput()   lib/campaign-forecast/hydration/
      │
      ▼
computeCampaignForecast()    lib/campaign-forecast/campaign-forecast-engine.ts
      │
      ├── Campaign Studio
      ├── Quotations
      ├── Shortlists
      └── Exports / Proposals
```

**Rule:** No module manually assembles forecast engine inputs. Build a profile, hydrate, then forecast.

## Creator Forecast Profile schema

`CreatorForecastProfile` (`forecast_profile_v1`) sections:

| Section | Purpose |
|---------|---------|
| `identity` | creatorKey, unifiedId, influencerId, discoveredProfileId |
| `primaryPlatform` / `platforms` | Canonical platform keys |
| `audience` | Country, categories, niche, interests |
| `followers` / `engagement` | Current size and ER |
| `historicalPerformance` | Normalized time-series + trends |
| `publicationPerformance` | Enrichment publications |
| `campaignPerformance` | Aggregated campaign publication results |
| `forecastBaselines` | Platform × content-type baselines |
| `freshness` / `confidence` / `readiness` | Data quality signals |
| `diagnostics` | Explainability + source mapping |
| `versioning` | profile, baseline, historical versions |
| `forecastContext` | Commercial deliverables (quotations, studio) |

### Readiness states

- `ready` — sufficient history/baselines
- `limited_historical` — partial creator history
- `benchmark_only` — platform benchmarks only
- `missing_performance` — no follower data

## Forecast Profile Builder

Entry points:

- `buildCreatorForecastProfile(context)` — sync, from in-memory context
- `loadAndBuildCreatorForecastProfile(supabase, input)` — async, loads DB sources

Source loaders (`profile/sources/load-db-sources.ts`):

- `creator_content_performance_baselines`
- `influencer_metrics_history` / `profile_metrics`
- `campaign_publications`
- Enrichment via `UnifiedCreatorResult`

## Source mapping

| Profile section | Primary DB / API sources |
|-----------------|--------------------------|
| `identity` | `unified_id`, `influencers.id`, `discovered_profiles.id` |
| `followers`, `engagement` | `influencer_platform_accounts`, unified metrics |
| `historicalPerformance` | `influencer_metrics_history`, `profile_metrics` |
| `publicationPerformance` | `influencer_platform_accounts.recent_publications` |
| `campaignPerformance` | `campaign_publications` |
| `forecastBaselines` | `creator_content_performance_baselines` + computed from publications |
| `audience` | Creator DNA fields on unified browse row |
| Manual roster paths | Quotation/shortlist/studio export snapshots |

## Hydration

```typescript
import {
  buildCreatorForecastProfile,
  computeCampaignForecastFromProfiles,
  profileToForecastCreatorInput,
} from "@/lib/campaign-forecast";

const profile = buildCreatorForecastProfile({ unified: creatorRow });
const forecast = computeCampaignForecastFromProfiles([profile], {
  campaignPlatform: "instagram",
});
```

`profileToForecastCreatorInput()` is the **only** mapping from profile → `CampaignForecastCreatorInput`.

## Consumer migration

| Module | Profile builder | Forecast entry |
|--------|-----------------|----------------|
| Campaign Studio | `searchCardsToForecastProfiles` | `computeCampaignForecastFromProfiles` |
| Quotations | `quotationItemsToForecastProfiles` | `computeCampaignForecastFromProfiles` |
| Shortlists | `shortlistGroupsToForecastProfiles` | `computeCampaignForecastFromProfiles` |
| Unified browse | `unifiedCreatorToForecastProfile` | `profileToForecastCreatorInput` |

Legacy adapter exports (`quotationItemsToForecastCreators`, etc.) remain for compatibility but delegate through profiles internally.

## Database migration

`supabase/migrations/20260720120000_forecast_data_foundation.sql`:

1. **`influencer_metrics_history`** — internal creator metrics time-series (follower growth, ER, avg views, posting frequency)
2. **`creator_content_performance_baselines`** — reusable platform × content-type baselines

Both tables are additive, RLS-enabled, and backward compatible. `loadInternalHistoricalMetrics()` in `lib/creators/historical-metrics.ts` now reads the new table.

## Validation examples

Run:

```bash
npm run test:forecast-profile-foundation
npm run test:campaign-forecast-engine
```

### High-confidence diagnostics

```
Forecast Ready: true
Readiness: ready
Historical Samples: 18+
Baseline Source: campaign_publications
Confidence: 70–100
Last Updated: ~3 days ago
```

### Low-confidence diagnostics

```
Forecast Ready: true
Readiness: benchmark_only
Historical Samples: 0
Using: platform_benchmark
Confidence: ~40–60
Reason: Insufficient creator history
```

## Versioning

| Constant | Value |
|----------|-------|
| `FORECAST_PROFILE_VERSION` | `forecast_profile_v1` |
| `FORECAST_BASELINE_VERSION` | `baseline_v1` |
| `FORECAST_HISTORICAL_DATA_VERSION` | `historical_v1` |
| Engine (unchanged) | `forecast_engine_v3` |

## Success criteria (Phase 3)

- [x] One normalized `CreatorForecastProfile` per creator
- [x] Single hydration path into `computeCampaignForecast()`
- [x] Normalized historical performance structure
- [x] Campaign publication aggregation reusable across modules
- [x] Diagnostics, readiness, confidence on every profile
- [x] Duplicate adapter hydration eliminated
- [x] Backward-compatible exports and engine calculations
- [x] Schema foundation for future self-learning calibration

## Related docs

- [CAMPAIGN_FORECAST_ENGINE.md](./CAMPAIGN_FORECAST_ENGINE.md) — Phase 1
- [CAMPAIGN_FORECAST_ENGINE_PHASE2.md](./CAMPAIGN_FORECAST_ENGINE_PHASE2.md) — Phase 2 intelligence
