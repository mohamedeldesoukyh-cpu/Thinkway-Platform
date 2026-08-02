# Enterprise Creator Intelligence

**Status:** **ACTIVE** platform capability — **Release 2.3 Phase 1** (not frozen)  
**Code:** `lib/enterprise-creator-intelligence/`  
**Registry:** [`PLATFORM_CAPABILITY_REGISTRY.md`](./PLATFORM_CAPABILITY_REGISTRY.md)  
**Production:** Not applied — requires explicit approval  

Extends frozen platform capabilities — does **not** redesign Architecture, Lifecycle OS, Document Lifecycle, Change Impact, Decision Center, or Bulk Framework.

---

## Sprint 1 — Historical Creator Intelligence (PROTECTED BASELINE)

| Attribute | Value |
|-----------|--------|
| Status | **Protected implementation baseline** for all later sprints |
| Capability status | Parent capability remains **ACTIVE** (do not freeze Enterprise Creator Intelligence) |
| Migration (Development) | `20260802120000_enterprise_creator_intelligence_historical.sql` — applied to `hsxrewjcbvmbkqdlzjhs` |
| Regression | `npm run test:enterprise-creator-intelligence` |

Later sprints **extend** this baseline. They must not redesign append-only capture, monthly projection uniqueness, or Sprint 1 metric definitions.

### Metrics (monthly time-series)

| Metric | Field |
|--------|--------|
| Monthly followers | `followers` |
| Monthly following | `following` |
| Monthly total posts | `posts_count` |
| Monthly average views | `avg_views` |
| Monthly median views | `median_views` |
| Monthly engagement | `engagement_rate` |
| Monthly posting frequency | `posting_frequency_per_week` |
| Monthly growth | `monthly_growth_rate` |
| Monthly follower difference | `follower_difference` |

### Data rules

1. **Raw captures are append-only** — `influencer_metrics_history` INSERT only (never overwrite prior capture rows).  
2. **Monthly series is a projection** — `creator_intelligence_monthly_metrics` unique on `(influencer_id, platform, period_month)`; recomputed from latest capture in that month without deleting raw history.  
3. Growth / follower difference are **derived** from the prior month row.  
4. Median views computed from recent publication sample at capture time.

### Entry points

```ts
import {
  appendCreatorMetricsCapture,
  loadCreatorMonthlyMetrics,
  buildHistoricalAiHints,
} from "@/lib/enterprise-creator-intelligence";
```

Automatic capture: after IPL `persistSnapshot` when `influencerId` is present.

---

## Purpose

Platform Creator Intelligence for:

- Planning Workspace  
- Client Workspace  
- Campaign Workspace  
- Reporting Hub  
- AI Copilot (hooks only — no AI in Phase 1)  
- Mobile App  

This is **not** a Discovery feature. Discovery remains acquisition; this layer owns reusable creator time-series and commercial/category/brand/campaign intelligence.

---

## Sprint roadmap (do not start early)

| Sprint | Scope | Status |
|--------|-------|--------|
| 1 | Historical Creator Intelligence | **Protected baseline** |
| 2 | Commercial Intelligence (CPM/CPE/EMV/ROI/pricing) | In progress after Sprint 1 baseline land |
| 3 | Category Intelligence (behaviour %) | Not started — gated on Sprint 2 approval |
| 4 | Brand Intelligence | Not started |
| 5 | Internal Campaign Intelligence | Not started |
| 6 | Creator Investment Score (explainable) | Not started |

---

## Platform extension rules

- Reuse IPL snapshots + influencer metrics history — no duplicate calculation engines.  
- Business changes that invalidate issued documents → **Change Impact Engine**.  
- Creator commercial changes affecting IOs → **Document Lifecycle** via Change Impact.  
- Bulk refresh/backfill jobs → **Platform Bulk Operations Framework**.  
- Money display (Sprint 2+) → **Financial Display Standard**.  
- No AI execution — AI-ready hints only (`buildHistoricalAiHints`).  
- No Production deployment without explicit approval.

---

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Lifecycle / BPN / Decision Center | Unchanged — consumers only |
| Document Lifecycle / Change Impact | Extended when creator changes affect documents (future wiring) |
| Discovery | Not the owner of this intelligence |
| Operational effort | Historical series eliminates ad-hoc spreadsheet trends for Planning/Client |
