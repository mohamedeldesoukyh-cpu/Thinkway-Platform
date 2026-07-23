# Campaign Optimization Engine — Phase 4

Phase 4 adds an **Optimization Engine** on top of the Campaign Forecast Engine. Forecasting answers *"What will this campaign achieve?"* Optimization answers *"How can this campaign perform better?"*

## Architecture

```
Creator Forecast Profiles
          │
          ▼
Campaign Forecast Engine          (unchanged — SSOT for metrics)
          │
          ▼
Campaign Optimization Engine      lib/campaign-optimization/
          │
          ▼
CampaignOptimizationReport
          │
          ├── Campaign Studio
          ├── Quotations
          ├── Shortlists
          ├── Proposal Generator
          └── AI Campaign Assistant
```

**Rule:** `optimizeCampaign()` consumes `CampaignForecast` output only. It never recalculates forecast metrics or reads raw DB tables.

## Entry point

```typescript
import { optimizeCampaign } from "@/lib/campaign-optimization";

const report = optimizeCampaign({
  forecast, // from computeCampaignForecast / computeCampaignForecastFromProfiles
  context: {
    budget: { amount: 250_000, currency: "EGP" },
    tierMix: [{ tier: "Micro", percent: 40 }],
    creatorTiers: { "inf:abc": "Macro" },
    campaignPlatform: "instagram",
    audienceTargets: { countryCodes: ["EG"] },
  },
});
```

## Report schema

`CampaignOptimizationReport` (`campaign_optimization_v1`):

| Section | Purpose |
|---------|---------|
| `healthScore` | Weighted 0–100 campaign health with per-dimension deductions |
| `optimizationScore` | Headroom score (room to improve) |
| `opportunities[]` | Prioritized gaps by category and impact |
| `recommendations[]` | Actionable, quantified next steps |
| `scenarioComparisons[]` | Current vs reach / engagement / budget / balanced |
| `diagnostics` | Creator count, overlap ratio, reach efficiency |
| `explainability` | Traceability bullets |

## Optimization categories

| Category | Examples |
|----------|----------|
| Reach | Overlap, reach concentration, low net-reach efficiency |
| Budget | Cost per reach / view / engagement |
| Creator mix | Macro-heavy roster, tier mix deviation |
| Platform | Instagram-only, missing TikTok |
| Deliverable | Story-heavy mix, single content type dominance |
| Audience | ER below benchmark, geo/category alignment |

## Health score model

Weighted dimensions (sum = 100):

| Dimension | Weight |
|-----------|--------|
| Forecast confidence | 20 |
| Reach efficiency | 20 |
| Budget efficiency | 15 |
| Audience quality | 15 |
| Creator diversity | 15 |
| Platform balance | 15 |

Every deduction includes `factor`, `points`, and `reason`.

## Scenario comparison

Five scenarios derived from opportunity impact projections:

1. **Current Campaign** — baseline forecast KPIs
2. **Optimized for Reach** — overlap reduction + reach opportunities
3. **Optimized for Engagement** — creator-mix + audience opportunities
4. **Optimized for Budget** — cost-efficiency opportunities
5. **Balanced Strategy** — blended 55% of max gains

Scenarios apply documented levers to forecast KPI snapshots; they do not alter the Forecast Engine.

## Consumer integration

| Module | Integration |
|--------|-------------|
| Campaign Studio | `studioOptimizationArtifacts()` → persisted on `PerformanceSectionData.campaignOptimization` |
| Quotations | `optimizeQuotationCampaign()` in `lib/quotations/quotation-optimization.ts` |
| Shortlists | `optimizeShortlistCampaign()` → summary health + top recommendation |
| Proposal export | `resolveCampaignOptimization()` via section data resolver |
| AI Assistant | `extractOptimizationForAssistant()` in campaign-context |

## Validation

```bash
npm run test:campaign-optimization
npm run test:campaign-forecast-engine
```

## Success criteria

- [x] Single `optimizeCampaign()` entry point — no duplicate optimization logic
- [x] Evidence-based recommendations traceable to forecast metrics
- [x] Campaign health score with explained deductions
- [x] Prioritized opportunities (high / medium / low)
- [x] Scenario comparison before launch
- [x] Actionable, quantified recommendations
- [x] Forecast Engine unchanged

## Related docs

- [CAMPAIGN_FORECAST_ENGINE.md](./CAMPAIGN_FORECAST_ENGINE.md)
- [CAMPAIGN_FORECAST_ENGINE_PHASE2.md](./CAMPAIGN_FORECAST_ENGINE_PHASE2.md)
- [CAMPAIGN_FORECAST_ENGINE_PHASE3.md](./CAMPAIGN_FORECAST_ENGINE_PHASE3.md)
