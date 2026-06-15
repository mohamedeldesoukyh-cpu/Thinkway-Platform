# Intelligence Revenue Reconciliation

> Generated 2026-06-15 from corrected Excel workbook. **Analysis only — no ETL, no database writes.**  
> **2023 header fix applied:** harmonizer now uses `normalizeExcelHeader` — 2023 revenue parses correctly (~$23.2M).

**Source file:** `c:\Users\X13 Yoga G3\Documents\Thinway\Thinkway Intelligence Engine\data 2023 - 2026.xlsx`

**Related:** [`INTELLIGENCE_PRELOAD_AUDIT.md`](./INTELLIGENCE_PRELOAD_AUDIT.md) · [`INTELLIGENCE_GO_LIVE_CHECKLIST.md`](./INTELLIGENCE_GO_LIVE_CHECKLIST.md)

---

## Headline (harmonized)

| Metric | Value |
| --- | ---: |
| Total revenue | **$85,144,691** |
| Total cost | **$65,909,393** |
| Margin / GP | **$19,235,298** |
| Margin % | **22.6%** |
| Harmonized campaign lines | **27,364** |

Historical workbook columns: **revenue** = `Revenue ($) ROI` / `Revenue ($)` (normalized header lookup); **cost** = `Cost ($)` / `Our Cost ($)` / `our cost`. No UR/AF billable-base columns — billable reconciliation is revenue vs cost at line grain only.

---

## 2023 revenue fix (harmonizer before / after)

| Metric | Pre-fix harmonizer | Post-fix harmonizer |
| --- | ---: | ---: |
| 2023 sheet revenue | **$0** | **$23,198,146** |
| 2023 rows with revenue | 0 | 6,539 |
| 2023 cost | $17,073,781 | $17,073,781 |
| Headline total revenue | $61,946,545 | **$85,144,691** |

**Root cause:** Sheet `2023` xlsx reads header as `" Revenue ($) ROI "` (leading/trailing spaces). Exact-key lookup in `harmonizeCampaignRow` missed it. **Fix:** `normalizeExcelHeader` trims, collapses spaces, lowercases, and inserts consistent spacing around `$` / `()` so all formatting variants resolve to `revenue ( $ ) roi`.

---

## Comparison vs prior audit (2026-06-15 baseline)

| Metric | Original baseline | Pre-fix (corrected workbook) | **Post-fix (current)** |
| --- | ---: | ---: | ---: |
| Total revenue | $47,869,007 | $61,946,545 | **$85,144,691** |
| Total cost | $36,583,448 | $65,909,393 | $65,909,393 |
| Margin / GP | $11,285,559 | -$3,962,848 | **$19,235,298** |
| Margin % | 23.6% | -6.4% | **22.6%** |
| Campaign lines | 14,177 | 27,364 | 27,364 |
| 2023 revenue | — | $0 | **$23,198,146** |

---

## Revenue / cost / margin by year (harmonized)

Year from `period_year` (`Ad live date` year when present, else sheet tab name).

| Year | Lines | Revenue (USD) | Cost (USD) | GP (USD) | Margin % |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2022 | 2 | $4,476 | $3,820 | $656 | 14.7% |
| 2023 | 6,568 | **$23,193,670** | $17,069,961 | $6,123,709 | 26.4% |
| 2024 | 5,277 | $18,483,309 | $13,956,438 | $4,526,871 | 24.5% |
| 2025 | 10,117 | $27,077,326 | $21,503,093 | $5,574,233 | 20.6% |
| 2026 | 5,400 | $16,385,910 | $13,376,080 | $3,009,830 | 18.4% |
| **Total** | **27,364** | **$85,144,691** | **$65,909,393** | **$19,235,298** | **22.6%** |

**2023 resolved:** All 6,568 harmonized 2023 lines now carry parsed revenue (6,539 with non-zero values). Prior preload showed $0 due to header whitespace mismatch — fixed via `normalizeExcelHeader`.

---

## Revenue by sheet — raw vs filtered vs harmonized

### Campaign sheets

| Sheet | Raw rows | Filtered rows | Blank rows removed | Raw revenue | Filtered revenue | Raw cost | Filtered cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2023 | 6,575 | 6,570 | 5 | **$23,198,146** | **$23,198,146** | $17,073,781 | $17,073,781 |
| 2024 | 16,050 | 5,276 | 10,774 | $18,508,947 | $18,508,947 | $13,975,734 | $13,975,734 |
| 2025 | 10,749 | 10,116 | 633 | $27,042,414 | $27,042,414 | $21,475,839 | $21,475,839 |
| 2026 | 10,749 | 5,402 | 5,347 | $16,395,184 | $16,395,184 | $13,384,038 | $13,384,038 |
| **Campaign total** | **44,123** | **27,364** | **16,759** | **$85,144,691** | **$85,144,691** | **$65,909,393** | **$65,909,393** |

Filtered revenue and harmonized revenue **match** per sheet (same `harmonizeCampaignRow` path with normalized headers).

### Database sheet (vendors — no campaign revenue)

| Sheet | Raw rows | Filtered rows | Notes |
| --- | ---: | ---: | --- |
| Database | 8,452 | 8,379 | Influencer master; pricing columns only — excluded from revenue totals above |

---

## Discrepancies and reconciliation notes

| Check | Result |
| --- | --- |
| Sum of harmonized lines = headline total | ✓ $85,144,691 revenue · $65,909,393 cost |
| Sum by `period_year` = headline total | ✓ (± rounding) |
| Filtered sheet revenue = harmonized revenue | ✓ No parser drift between filter and harmonize |
| 2023 revenue parses | ✓ **$23,198,146** (was $0 pre-fix) |
| Duplicate campaign keys | 0 — no double-count at camp#+code# grain |
| Billable vs cost | No separate billable column; revenue column used as billable proxy |

### Corrected file vs prior file — structural deltas

| Sheet | Prior raw rows | Current raw rows | Prior data rows | Current data rows | Interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| 2023 | 6,575 | 6,575 | 6,570 | 6,570 | Same volume; revenue now parses via header normalization |
| 2024 | 6,250 | **16,050** | 2,006 | **5,276** | Sheet expanded; ~68% blank padding in prior layout |
| 2025 | 199 | **10,749** | 199 | **10,116** | Major data restore — was nearly empty |
| 2026 | 10,749 | 10,749 | 5,402 | 5,402 | Unchanged |
| Database | 8,452 | 8,452 | 8,379 | 8,379 | Unchanged |

Post-fix aggregate margin is **22.6%** ($19.2M GP on $85.1M revenue), consistent with the original 23.6% baseline once 2023 revenue is included.

---

## Warehouse expected totals (updated)

Use after full ETL; must match preload audit **±0** rows and **±$1** on sums.

| Table | Prior expected | **Current expected** |
| --- | ---: | ---: |
| `historical_campaigns_raw` | 14,177 | **27,364** |
| `historical_influencers_raw` | 8,379 | **8,379** |
| `int_campaigns` | 14,177 | **27,364** |
| `int_clients` | 97 | **197** |
| `int_brands` | 174 | **318** |
| `int_influencers` | 13,112 | **15,509** |
| `int_pricing_history` | 13,886 | **26,710** |
| `int_margin_history` | 14,162 | **27,347** |
| `int_benchmarks` | 159 | **253** |

**Post-load SQL revenue check** (`int_campaigns`):

```sql
SELECT
  COUNT(*) AS line_count,
  ROUND(SUM(revenue_usd)::numeric, 0) AS total_revenue_usd,
  ROUND(SUM(cost_usd)::numeric, 0) AS total_cost_usd,
  ROUND(SUM(COALESCE(gp_usd, revenue_usd - cost_usd))::numeric, 0) AS total_gp_usd
FROM intelligence.int_campaigns;
```

**Expected:** 27,364 lines · **$85,144,691** revenue · **$65,909,393** cost · **$19,235,298** GP.

**Reference client (top by revenue):** L'Oréal Middle East FZE — **$17,816,288** revenue, 8,313 lines.

---

## Re-run (analysis only)

```bash
INTELLIGENCE_ETL_DRY_RUN=1 npm run intelligence:preload-audit
```

Do **not** run `npm run intelligence:etl` until stakeholders sign off on headline totals and duplicate influencer keys.
