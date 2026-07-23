# Campaign Forecast Engine (Phase 1)

Unified source of truth for roster-based campaign forecasting across Thinkway.

**Module:** `lib/campaign-forecast/`  
**Entry point:** `computeCampaignForecast(input)`  
**Version:** `forecast_engine_v3` (Phase 2 intelligence — see [`CAMPAIGN_FORECAST_ENGINE_PHASE2.md`](./CAMPAIGN_FORECAST_ENGINE_PHASE2.md))

## Architecture

```
Campaign roster (creators + deliverables)
        ↓
Campaign Forecast Engine  (`computeCampaignForecast`)
        ↓
CampaignForecast (immutable result)
        ↓
Quotations · Shortlists · Exports · Decision Simulator · KPI strips
```

Publication performance (actual provider metrics) continues to use `reach-forecast-engine`, `impressions-forecast-engine`, and `engagement-rate-engine` at the **publication** layer. The Campaign Forecast Engine **delegates** to those engines for per-deliverable calculations.

Budget-driven Studio outputs (`generateKpiForecast`) remain budget-based by design and are documented separately.

---

## KPI Definitions

| KPI | Definition | Not equal to |
|-----|------------|--------------|
| **Audience Size** | Total unique followers represented by selected creators. Each creator counted once; multiple options/packages do not duplicate followers. Uses campaign platform when specified, else creator primary platform. | Estimated Reach |
| **Estimated Reach** | Expected unique people reached by campaign content. `followers × platform multiplier × content-type multiplier × deliverable adjustment`. | Audience Size, Impressions |
| **Estimated Impressions** | Total expected content impressions across deliverables. Derived via impressions forecast formulas (e.g. views × 1.15 for Reels). | Reach, Views |
| **Estimated Views** | Platform-specific expected views/plays. Uses view-to-reach ratios by content type when actual views unavailable. | Reach |
| **Estimated Engagement** | Expected likes + comments + shares + saves. Uses `engagement-rate-engine` with creator ER when available. | Engagement Rate % alone |

---

## Mapping Report

| Previous location | New engine | Notes |
|-------------------|------------|-------|
| `lib/quotations/quotation-aggregate-metrics.ts` (`aggregateQuotationReach` follower sum) | Campaign Forecast Engine | `audience_size` = followers; `estimated_reach` = forecast |
| `lib/performance/reach-forecast-engine.ts` (direct export calls) | Campaign Forecast Engine | Still used internally per deliverable |
| `features/quotations/export/quotation-document.ts` (`exportGroupEstimatedReach`) | `forecastCreator` | Tier breakdown + summary KPIs |
| `features/discovery/shortlists/templates/shortlist-template-payload.ts` | `forecastCreator` | Tier reach export |
| `features/discovery/shortlists/export/shortlist-document.ts` (follower sum summary) | `computeCampaignForecast` | Audience size + reach split |
| `features/campaign-decision-engine/kpi-simulator.ts` | `computeCampaignForecast` | Roster reach/engagement/impressions |
| `lib/performance/impressions-forecast-engine.ts` | Used internally | Not called directly from UI/export |
| `lib/performance/engagement-rate-engine.ts` | Used internally | Not called directly from UI/export |

**Unchanged (by design):**

- Discovery engine, Creator DNA, DB schema, BullMQ, campaign execution, performance provider sync
- Budget-driven `features/campaign-outputs/generators/kpi-forecast.ts`
- Industry template KPIs in Campaign Studio (`industry-intelligence.ts`)

---

## Forecast Example — 10 Creators

Input: 10 creators with followers 10K–100K, alternating Instagram Reels / TikTok videos, ER 3.0%–4.8%.

Output (from `computeCampaignForecast`):

- **Audience Size:** sum of 10 unique follower counts (550,000 in test fixture)
- **Estimated Reach:** sum of per-creator `followers × content multiplier × deliverable adjustment` (less than audience size)
- **Estimated Impressions:** aggregated deliverable impressions
- **Estimated Views:** aggregated platform view estimates
- **Estimated Engagement:** aggregated engagements from ER + view/reach denominators

Run: `npm run test:campaign-forecast-engine`

---

## Explainability Example — Single Creator

Creator: 100,000 Instagram followers, 1× IG Reel, ER 4.5%

1. Audience size = 100,000 (followers counted once)
2. Reach multiplier for `instagram_reel` = 0.45
3. Deliverable adjustment = 1.0 (single post)
4. Estimated reach = 100,000 × 0.45 = **45,000**
5. View ratio for reels = 1.2 → estimated views = 54,000
6. Impressions = views × 1.15 = **62,100** (formula from impressions engine)
7. Engagements = views × ER (4.5%) ≈ **2,430**

Access programmatically:

```ts
import { computeCampaignForecast, explainCreatorForecastStepByStep } from "@/lib/campaign-forecast";

const forecast = computeCampaignForecast({ creators: [...] });
const steps = explainCreatorForecastStepByStep(forecast, creatorKey);
```

Every forecast includes `assumptions`, `confidenceScore`, `calculationSummary`, and `explanation` arrays.

---

## Backward Compatibility

- `QuotationDetail.estimated_reach` now returns forecast reach (not follower sum)
- `QuotationDetail.audience_size` added for deduplicated follower total
- Export summary adds `audienceSize` field; KPI labels updated to **Audience Size** / **Est. Reach**
- Shortlist summary adds `estimatedReach`, `estimatedImpressions`, `estimatedViews`, `estimatedEngagements`
- Existing API field names preserved where possible; values and labels improved
