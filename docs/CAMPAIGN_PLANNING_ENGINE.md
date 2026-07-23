# Campaign Planning Engine — Phase 6

Phase 6 transforms Thinkway into an **AI campaign planning platform**. A campaign brief automatically produces a complete, explainable **Campaign Strategy** before any creator is searched.

## Architecture

```
Campaign Brief
        │
Campaign Planning Engine          lib/campaign-planning/
        │
CampaignStrategy
        │
Discovery Brief → Discovery Engine
        │
Creator Selection → Forecast → Optimization → Decision
```

**Rule:** The Planning Engine orchestrates intelligence. It does **not** modify Discovery, Forecast, Optimization, Decision engines, or Creator DNA.

## Entry point

```typescript
import { generateCampaignStrategy } from "@/lib/campaign-planning";

const strategy = generateCampaignStrategy({
  brief: {
    objective: "Brand awareness launch",
    budget: { amount: 350_000, currency: "EGP" },
    durationWeeks: 6,
    geography: ["Egypt"],
    audience: "Women 18-34 interested in skincare",
    platforms: ["instagram", "tiktok"],
  },
});
```

## CampaignStrategy schema

| Section | Contents |
|---------|----------|
| `creatorMix` | Total creators, tier counts/percentages, reasoning |
| `platformStrategy` | Platform allocation, budget/creator split |
| `deliverableStrategy` | Reels, stories, posts, TikTok/YouTube mix + quantities |
| `budgetStrategy` | Tier/platform/deliverable/production allocations |
| `timelineStrategy` | Waves, cadence, burst/always-on/hybrid mode |
| `audienceStrategy` | Segments, geography, gaps |
| `discoveryBrief` | `DiscoveryMappedFilter[]` for Discovery Engine |
| `strategyScore` | 0–100 quality score with deductions |

## Strategy quality dimensions

| Dimension | Weight |
|-----------|--------|
| Objective alignment | 20 |
| Budget efficiency | 20 |
| Audience alignment | 15 |
| Platform balance | 15 |
| Creator diversity | 15 |
| Timeline feasibility | 15 |

## Discovery mapping

Strategy → `discoveryBrief.mappedFilters` → `discoveryMappedFiltersToCreatorFilters()` → Discovery UI filters.

Mapped keys include: `platform`, `audience_country`, `creator_country`, `language`, `category`, `follower_min/min`, `engagement_min`.

## Consumer integration

| Module | Integration |
|--------|-------------|
| Campaign Studio | `studioPlanningArtifacts()` on brief merge → `sections.strategy.data.generatedStrategy` |
| Discovery | `strategyToDiscoveryFilters()` |
| AI Assistant | `extractPlanningForAssistant()` |
| Strategy section | `resolveCampaignStrategy()` |

## Validation

```bash
npm run test:campaign-planning
```

## Success criteria

- [x] Briefs produce complete campaign strategies automatically
- [x] Discovery receives structured filters, not raw prompts
- [x] Budget, mix, platforms, deliverables, timeline recommended pre-search
- [x] Strategy quality measurable with explainability
- [x] Forecast/Optimization/Decision engines unchanged

## Related docs

- [CAMPAIGN_FORECAST_ENGINE_PHASE3.md](./CAMPAIGN_FORECAST_ENGINE_PHASE3.md)
- [CAMPAIGN_OPTIMIZATION_ENGINE.md](./CAMPAIGN_OPTIMIZATION_ENGINE.md)
- [CAMPAIGN_DECISION_INTELLIGENCE.md](./CAMPAIGN_DECISION_INTELLIGENCE.md)
