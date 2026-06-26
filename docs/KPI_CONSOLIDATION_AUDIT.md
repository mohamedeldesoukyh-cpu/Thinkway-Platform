# KPI Consolidation Audit

**Branch:** `refactor/phase2-shared-domains-ui`  
**Date:** June 2026  
**Scope:** Phase 2 UI Consolidation — Step 2

---

## Audit: All KPI Implementations Found

| # | Component | Path | Pattern | Domain |
|---|-----------|------|---------|--------|
| 1 | `CampaignPerformanceKpiStrip` | `features/campaigns/components/performance/campaign-performance-kpi-strip.tsx` | Horizontal strip + icons | Campaign performance center |
| 2 | `CampaignKpiStrip` | `features/campaigns/components/campaign-kpi-strip.tsx` | Strip + PO banner | Campaign workspace |
| 3 | `CampaignsKpiStrip` | `features/campaigns/components/campaigns-kpi-strip.tsx` | Strip | Campaign list page |
| 4 | `CampaignBillingKpiStrip` | `features/campaigns/components/campaign-billing-kpi-strip.tsx` | Strip | Campaign billing tab |
| 5 | `GroupKpiStrip` | `features/groups/components/group-kpi-strip.tsx` | Sticky strip | Group workspace |
| 6 | `BillingKpiStrip` | `features/billing/components/billing-kpi-strip.tsx` | Strip + alert banner | Billing workspace |
| 7 | `InvoiceWorkspaceKpiStrip` | `features/billing/components/invoice-workspace-kpi-strip.tsx` | Strip | Invoice workspace |
| 8 | `QuotationKpiStrip` | `features/quotations/components/quotation-kpi-strip.tsx` | Strip + GP health | Quotation workspace |
| 9 | `ExecutiveKpiStrip` | `features/executive-dashboard/components/executive-kpi-strip.tsx` | Strip + loading | Analytics / executive dashboard |
| 10 | `CollectionsKpiStrip` | `features/collections/components/collections-kpi-strip.tsx` | Strip + trends | Collections workspace |
| 11 | `PlanningKpiStrip` | `features/planning/components/planning-kpi-strip.tsx` | Strip + loading | Planning workspace |
| 12 | `AgingKpiStrip` | `features/finance/aging/components/aging-kpi-strip.tsx` | Grid metric cards | AR aging workspace |
| 13 | `VendorKpiStrip` | `features/vendors/components/vendor-kpi-strip.tsx` | Strip | Vendor workspace |
| 14 | Inline strip | `features/vendors/components/tabs/vendor-billing-tab.tsx` | Strip (6 cards) | Vendor billing tab |
| 15 | Inline strip | `features/intelligence/components/intelligence-workspace.tsx` | Strip | Intelligence warehouse |
| 16 | `HomeWelcomeBanner` | `features/home/components/home-welcome-banner.tsx` | Hero KPI row (dark navy) | Home dashboard |
| 17 | `TreasuryDashboardView` | `features/treasury/components/treasury-dashboard-view.tsx` | Grid cards | Treasury dashboard |
| 18 | Inline `KpiCard` | `features/reports/components/spending-by-category-view.tsx` | Grid cards | Spending-by-category report |
| 19 | Inline `KpiCard` | `features/finance/po-tracker/components/po-tracker-workspace.tsx` | Section cards | PO tracker |
| 20 | Inline `KpiCard` | `features/finance/vat/components/vat-workspace.tsx` | Section cards | VAT workspace |

**Related non-KPI summary surfaces (out of strip scope — preserved as-is):**

| Component | Path | Notes |
|-----------|------|-------|
| `CampaignCommercialSummaryCard` | `features/campaigns/components/campaign-commercial-summary-card.tsx` | Form profile fields, not metrics |
| `InvoiceFinancialSummaryCard` | `features/billing/components/invoice-financial-summary-card.tsx` | Invoice batch preview ledger |
| VIO / CIO document layouts | `lib/io/*-template-render.ts` | PDF/HTML export, not React KPI strips |
| Client profile | `features/clients/components/tabs/client-overview-tab.tsx` | Form workspace — no KPI strip |

**Prior shared infra (now consolidated):**

- `components/ui/kpi-carousel.tsx` — carousel card renderer (125 LOC) with duplicated card chrome
- `operationalKpiValueClass()` in `operational-table-typography.ts` — value semantic coloring (reused via `kpi-utils`)

---

## Duplicate Patterns Identified

| Pattern | Occurrences (before) | Location |
|---------|---------------------|----------|
| `ACCENT_TILE` color map | 12 | All carousel-based strips + vendor billing tab |
| Hardcoded palette accents (`emerald-`, `red-`, `amber-`, `#hex`) | 5 | Performance strip, collections, planning, billing alert, aging |
| Loading skeleton row | 3 | Executive, collections, planning strips |
| Mixed-currency disclaimer | 4 | Executive, billing, collections, planning |
| Carousel card layout JSX | 1 central + implicit copies | `kpi-carousel.tsx` |
| Inline grid `KpiCard` | 3 | Spending report, PO tracker, VAT workspace |
| Treasury `Card` KPI grid | 1 | Treasury dashboard |
| Trend chip row | 1 | Collections strip |
| GP health text class | 1 | Quotation strip (domain logic — kept) |
| Value semantic coloring | 8 strips | Via `operationalKpiValueClass` |

---

## Shared Infrastructure Created

```
components/shared/kpi/
  kpi-config.ts         # Accent maps, health tones, variant mapping, layout tokens
  kpi-utils.ts          # Formatting, value class resolution, aging/variant helpers
  health-indicator.tsx  # Semantic health dot (success/warning/destructive/neutral)
  kpi-card.tsx          # Single carousel KPI card (title, value, subtitle, trend, tooltip, loading)
  kpi-strip.tsx         # Horizontal scroll strip + nav + loading + mixed-currency notice
  metric-card.tsx       # Grid/section/card/aging metric layouts
  kpi-config.test.ts    # Regression tests
```

`components/ui/kpi-carousel.tsx` is now a backward-compatible re-export of `KpiStrip`.

### Semantic health tokens (Phase 2 Step 1 alignment)

| Token | Usage |
|-------|-------|
| `success` | Positive variant, GP on target, collected |
| `warning` | Near PO limit, low margin, aging warn bucket |
| `destructive` | PO exceeded, negative variant, aging danger bucket |
| `neutral` | Default counts, aging OK bucket |

All health/value/surface classes use `success`, `warning`, `destructive`, `muted-foreground`, `brand-*` tokens — no hardcoded palette colors in strip files.

### KpiCard / KpiStrip capabilities

| Prop | Supported |
|------|-----------|
| title | ✓ |
| value | ✓ |
| subtitle | ✓ (`subtext` alias on carousel items) |
| trend | ✓ |
| icon | ✓ |
| health state | ✓ |
| loading state | ✓ (strip-level skeleton) |
| tooltip | ✓ |
| compact mode | ✓ |
| currency formatting | ✓ via `formatKpiCurrency` |
| percentage formatting | ✓ via `formatKpiPercent` |

---

## Before / After Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| KPI strip wrapper files | 13 | 13 | 0 removed (wrappers preserved) |
| Inline `KpiCard` function definitions | 3 | 0 | **−100%** |
| `ACCENT_TILE` map definitions in feature files | 12 | 0 | **−100%** |
| Loading skeleton implementations | 3 | 1 (`KpiStrip`) | **−67%** |
| Mixed-currency notice strings | 4 | 1 (`KpiMixedCurrencyNotice`) | **−75%** |
| Carousel card layout definitions | 1 monolithic | 1 shared `KpiCard` | Consolidated |
| Hardcoded palette in KPI strip files | ~5 surfaces | 0 | **−100%** |
| Shared KPI infra files | 0 | 7 | +7 |

**Duplicate reduction:** ~12 accent maps + 3 inline card layouts + 3 skeleton blocks + 4 currency notices → 1 config + 1 utils + 3 components ≈ **~88% reduction** in duplicated KPI presentation logic.

**Estimated LOC removed from feature files:** ~340 lines of duplicated layout/maps/skeletons (offset by ~55 LOC of shared imports per wrapper).

---

## Files Removed

None. All 13 domain KPI strip files remain as thin wrappers (per requirement §5).

**Inline duplicates removed from:**

- `features/reports/components/spending-by-category-view.tsx` — local `KpiCard`
- `features/finance/po-tracker/components/po-tracker-workspace.tsx` — local `KpiCard`
- `features/finance/vat/components/vat-workspace.tsx` — local `KpiCard`

---

## Refactored Wrappers (all use `<KpiStrip />` or `<MetricCard />`)

| Wrapper | Shared component |
|---------|------------------|
| CampaignPerformanceKpiStrip | `KpiStrip` + `KPI_ACCENT_CLASS` |
| CampaignKpiStrip | `KpiStrip` + `accentKey` |
| CampaignsKpiStrip | `KpiStrip` |
| CampaignBillingKpiStrip | `KpiStrip` |
| GroupKpiStrip | `KpiStrip` |
| BillingKpiStrip | `KpiStrip` + `KpiMixedCurrencyNotice` |
| InvoiceWorkspaceKpiStrip | `KpiStrip` |
| QuotationKpiStrip | `KpiStrip` (GP health logic unchanged) |
| ExecutiveKpiStrip | `KpiStrip` + built-in loading |
| CollectionsKpiStrip | `KpiStrip` + variant utils + trend footer |
| PlanningKpiStrip | `KpiStrip` + variant utils |
| AgingKpiStrip | `MetricCard layout="aging"` |
| VendorKpiStrip | `KpiStrip` |
| Vendor billing tab | `KpiStrip` |
| Intelligence workspace | `KpiStrip` |
| Treasury dashboard | `MetricCard layout="card"` |
| Spending-by-category | `MetricCard` |
| PO tracker | `MetricCard layout="section"` |
| VAT workspace | `MetricCard layout="section"` |

---

## Tests

```bash
npx tsx components/shared/kpi/kpi-config.test.ts
```

Validation:

```bash
npx tsc --noEmit -p tsconfig.json   # pass
npm run build                        # pass
```

---

## Visual Parity

Browser screenshots were not captured in this CI/subagent environment. Visual parity is expected based on:

- Identical card dimensions (`168px` min-width), border, shadow, icon tile size
- Same accent rotation order (blue → purple → pink → green)
- Performance strip accents migrated from hex literals to equivalent brand/success/warning tokens (minor shade shift possible in performance center only)
- Collections/planning variants migrated from `emerald/red/amber` to semantic `success/destructive/warning`
- Billing PO-over-consumed banner migrated from `red-500` to `destructive` token

Recommend manual spot-check on campaign workspace, executive dashboard, and collections workspace.

---

## Remaining Gaps

| Gap | Reason |
|-----|--------|
| `HomeWelcomeBanner` hero KPIs | Intentionally distinct dark-navy marketing layout — not a carousel strip |
| `InvoiceFinancialSummaryCard` | Ledger preview rows, not KPI cards |
| `CampaignCommercialSummaryCard` | Profile inheritance fields, not metrics |
| VIO / CIO document summary blocks | Export HTML/PDF templates, not React components |
| Client profile metrics strip | No KPI strip exists on client workspace today |
| `operationalKpiValueClass` source | Remains in `operational-table-typography.ts` (shared with assignment grid); re-exported via `kpi-utils` |
| Export/PPT performance KPI CSS | Report template inline styles unchanged (export scope) |

---

## Intentionally Not Merged

- Home welcome banner (hero chrome)
- Invoice generation financial summary (form preview)
- Assignment selection summary bar (floating action context, not KPI strip)
- GP health calculation in `quotation-gp-health.ts` (domain logic; only presentation classes consumed)
