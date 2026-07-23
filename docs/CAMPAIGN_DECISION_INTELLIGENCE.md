# Campaign Decision Intelligence — Phase 5

Phase 5 transforms Thinkway into a **campaign decision-support platform**. The Decision Engine evaluates launch readiness, risks, KPI probabilities, and executive approval summaries using existing Forecast and Optimization outputs.

## Architecture

```
Forecast Engine
        │
Optimization Engine
        │
Commercial Intelligence  ──┐
Operational Intelligence ──┤
                           ▼
              Campaign Decision Engine     lib/campaign-decision/
                           │
                           ▼
              CampaignDecisionReport
                           │
     Studio · AI Assistant · Proposals · Approval · Exports
```

**Rule:** `evaluateCampaignDecision()` consumes `CampaignForecast` + `CampaignOptimizationReport` + `CampaignConfiguration`. It never recalculates forecast or optimization metrics.

## Entry point

```typescript
import { evaluateCampaignDecision } from "@/lib/campaign-decision";

const report = evaluateCampaignDecision({
  forecast,
  optimization,
  configuration: {
    kpiTargets: { reach: 500_000, engagement: 25_000 },
    commercial: { budget: { amount: 250_000, currency: "EGP" } },
    operational: {
      deliverablesDefined: true,
      planMandatoryMissing: [],
    },
  },
});
```

## Report schema

| Section | Purpose |
|---------|---------|
| `readiness` | Launch readiness state + label |
| `decisionScore` | Weighted executive score with deductions |
| `risks` | Categorized risks with severity, impact, mitigation |
| `riskMatrix` | Summary by reach/budget/creator/audience/operational |
| `kpiProbabilities` | Achievement likelihood per KPI (forecast-confidence-based) |
| `recommendations` | Business decisions (delay, replace creators, reduce overlap, etc.) |
| `approvalSummary` | Client-ready executive summary |
| `explainability` | Full traceability bullets |

## Launch readiness states

| State | Meaning |
|-------|---------|
| `ready` | Safe to proceed to approval |
| `ready_with_minor_risks` | Proceed after minor fixes |
| `needs_review` | Manager review required |
| `high_risk` | Significant launch risk |
| `not_ready` | Do not launch |

## Decision score dimensions

| Dimension | Weight |
|-----------|--------|
| Forecast confidence | 20 |
| Optimization quality | 20 |
| Risk level | 20 |
| Budget efficiency | 15 |
| Creator quality | 10 |
| Audience quality | 10 |
| Operational completeness | 15 |

## Consumer integration

| Module | Integration |
|--------|-------------|
| Campaign Studio | `studioDecisionArtifacts()` → `PerformanceSectionData.campaignDecision` |
| Quotations | `evaluateQuotationDecision()` |
| Shortlists | `evaluateShortlistDecision()` |
| AI Assistant | `extractDecisionForAssistant()` |
| Proposals | `resolveCampaignDecision()` |

## Validation

```bash
npm run test:campaign-decision
npm run test:campaign-optimization
```

## Success criteria

- [x] Business readiness assessment for every evaluated campaign
- [x] Pre-launch risk identification with mitigation
- [x] Evidence-based, explainable decision-making
- [x] Executive approval summaries
- [x] Standardized decision layer across Studio, exports, AI
- [x] Consumes Forecast + Optimization without duplicating logic

## Related docs

- [CAMPAIGN_FORECAST_ENGINE.md](./CAMPAIGN_FORECAST_ENGINE.md)
- [CAMPAIGN_OPTIMIZATION_ENGINE.md](./CAMPAIGN_OPTIMIZATION_ENGINE.md)
