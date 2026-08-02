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

## Sprint 2 — Commercial Intelligence (PROTECTED BASELINE)

| Attribute | Value |
|-----------|--------|
| Status | **Protected Commercial Intelligence baseline** (parent capability remains **ACTIVE**) |
| Extends | Sprint 1 Historical protected baseline (unchanged) |
| Code | `lib/enterprise-creator-intelligence/commercial/` |
| Migration (Development) | `20260802130000_enterprise_creator_intelligence_commercial.sql` |
| Regression | `npm run test:enterprise-creator-intelligence` · `npm run test:enterprise-creator-intelligence:commercial` |

### Metrics

CPM · CPE · EMV · ROI · Average Views · Median Views · Average Reach · Estimated Reach · Cost Per Deliverable · Historical Pricing · Negotiation Trend · Price Movement

### Standard dashboard object (every metric)

Current Value · Previous Value · Trend · Trend Direction · Trend Label · Confidence · Confidence Reason · Formula · Inputs · Missing Inputs · Source (system · collection method · last refresh · confidence) · Last Updated · Historical Series Available (Yes/No) · Comparison windows · Benchmark extension slots · Meaning · Reason · Business Context · Explainability package · Financial Display (`currentDisplay`)

### Product surfaces on the intelligence result

| Surface | Purpose |
|---------|---------|
| `commercialHealth` | Excellent / Good / Monitor / Attention / Critical — not a score |
| `investmentReadiness` | Commercial Ready / Needs More Data / Limited Confidence / Historical Only / Insufficient Campaign History — not Investment Score |
| `comparisons` | Current · Previous Month · Quarter · 6 Months · Year · Lifetime |
| `benchmarks` | Creator / Campaign / Category / Platform / Market slots (Market/Category not calculated in Sprint 2) |
| `consumers` | Planning · Client · Campaign · Reporting · Analytics · AI Copilot · Mobile |

### Rules

1. **Append-only commercial history** — `creator_intelligence_commercial_history` INSERT only.  
2. **Reuse formulas** — CPM/CPE via `lib/campaigns/performance-calculations.ts`; views median/average via Sprint 1 compute; pricing via quotation price reference.  
3. **Thinkway commercial data first** — assignments, publications, deliverable revenue, quotation history.  
4. **Financial Display Standard** — money `currentDisplay` uses `formatMoneyDetail` (ISO codes, never symbols).  
5. **AI-ready only** — `buildCommercialAiHints` / `aiHints` — no AI execution.

### Entry points

```ts
import {
  loadCreatorCommercialIntelligence,
  computeCreatorCommercialIntelligence,
  appendCommercialIntelligenceCapture,
  FORMULA_TEXT,
  COMMERCIAL_METRIC_SOURCES,
} from "@/lib/enterprise-creator-intelligence";
```

### Formulas (SSOT text)

| Metric | Formula ID | Formula |
|--------|------------|---------|
| CPM | `thinkway_cpm_v1` | `(cost / impressions) × 1000` |
| CPE | `thinkway_cpe_v1` | `cost / engagements` |
| EMV | `thinkway_emv_v1` | `(impressions / 1000) × benchmark_cpm` |
| ROI | `thinkway_roi_v1` | `(revenue − cost) / cost` |
| Cost Per Deliverable | `thinkway_cost_per_deliverable_v1` | `total_cost / deliverable_count` |
| Price Movement | `thinkway_price_movement_v1` | `(latest_quote − prior_quote) / prior_quote` |

`benchmark_cpm` = implied from Thinkway quotes + views: `(avg_quoted_cost / avg_views) × 1000` when available.

---

## Sprint 3 — Category & Brand Intelligence (PROTECTED BASELINE)

| Attribute | Value |
|-----------|--------|
| Status | **Protected Category & Brand Intelligence baseline** (parent capability remains **ACTIVE**) |
| Extends | Sprint 1 Historical + Sprint 2 Commercial (unchanged) |
| Code | `lib/enterprise-creator-intelligence/category-brand/` |
| Migration (Development) | `20260802140000_enterprise_creator_intelligence_category_brand.sql` |
| Regression | `npm run test:enterprise-creator-intelligence:category-brand` |

### Capabilities

| Area | Output |
|------|--------|
| Dynamic categories | Behavioural % for 30d / 90d / 180d / Lifetime (always total 100%) |
| Category trends | Increasing / Stable / Declining / Emerging + what/why/implication |
| Category confidence | Percent + based-on evidence (posts + window days) |
| Content mix | Reels / Stories / Carousel / Images / Video / Short Form / Long Form |
| Brand intelligence | Brand · industry · sponsored/organic · mentions · frequency · last collab · campaign type |
| Industry intelligence | Rollup from behavioural categories with trends |
| Brand affinity | Repeated / One-off / Long-term / Recent / Dormant (+ sentiment extension point only) |
| Content consistency | Highly Consistent → Highly Volatile (not a quality score) |
| Specialisation | Highly Specialised → Emerging Category Shift with why |
| Business readiness | Primary/secondary/emerging categories · industries · affinity · specialisation · consistency · confidence |

### Rules

1. **Append-only history** — `creator_intelligence_category_brand_history` INSERT only.  
2. **Reuse taxonomy** — `inferCategoriesFromProfileSignals` + `resolveCanonicalCategories` / keyword map — no second vocabulary.  
3. **Not Discovery** — enterprise behavioural intelligence for Planning/Client/AI/Reporting/Mobile.  
4. **AI-ready only** — `buildCategoryBrandAiHints` — no AI execution.  
5. **Do not start Sprint 4** until Product explicitly approves.

### Entry points

```ts
import {
  loadCreatorCategoryBrandIntelligence,
  computeCreatorCategoryBrandIntelligence,
  appendCategoryBrandIntelligenceCapture,
} from "@/lib/enterprise-creator-intelligence";
```

---

## Sprint roadmap (do not start early)

| Sprint | Scope | Status |
|--------|-------|--------|
| 1 | Historical Creator Intelligence | **Protected baseline** (`c31da64e`) |
| 2 | Commercial Intelligence | **Protected baseline** (`7c0f6984`) |
| 3 | Category & Brand Intelligence | **Protected baseline** (`ad861c01`) |
| 4 | *(reserved / next Product gate)* | Not started |
| 5 | Internal Campaign Intelligence | Not started |
| 6 | Creator Investment Score (explainable) | Not started |

---

## Platform extension rules

- Reuse IPL snapshots + influencer metrics history + campaign performance/commercial loaders — no duplicate calculation engines.  
- Business changes that invalidate issued documents → **Change Impact Engine**.  
- Creator commercial changes affecting IOs → **Document Lifecycle** via Change Impact.  
- Bulk refresh/backfill jobs → **Platform Bulk Operations Framework**.  
- Money display → **Financial Display Standard**.  
- No AI execution — AI-ready hints only.  
- No Production deployment without explicit approval.  
- Parent capability stays **ACTIVE** (not frozen).

---

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Lifecycle / BPN / Decision Center | Unchanged — consumers only |
| Document Lifecycle / Change Impact | Extended when creator changes affect documents (future wiring) |
| Discovery | Not the owner of this intelligence |
| Operational effort | Removes manual CPM/CPE/ROI/EMV/pricing/trend spreadsheets for Planning/Client/Campaign/Reporting/Mobile |
