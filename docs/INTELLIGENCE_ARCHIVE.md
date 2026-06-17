# Intelligence Module Archive

> **Archived:** 2026-06-16 · Module disabled from production navigation and route access. All code, schema, ETL, and migrations remain in the repository.

---

## What was built

Thinkway Intelligence is a read-only historical analytics workspace for 2023–2026 operational Excel data, isolated in a dedicated Supabase `intelligence` schema.

### Warehouse schema

Migration: `supabase/migrations/20260623010000_intelligence_warehouse.sql` (+ grants fix `20260623020000_intelligence_schema_grants_fix.sql`)

| Table | Purpose |
| --- | --- |
| `historical_campaigns_raw` | Raw Excel campaign rows (JSONB preserved) |
| `historical_influencers_raw` | Raw Excel vendor/database rows |
| `int_clients` | Resolved legal entities |
| `int_brands` | Resolved brands |
| `int_influencers` | Warehouse vendors (11,504 rows post-ETL) |
| `int_campaigns` | Harmonized campaign lines (27,364 rows) |
| `int_margin_history` | Per-line margin snapshots |
| `int_pricing_history` | Pricing history |
| `int_benchmarks` | Aggregated benchmark slices (253 rows) |

### ETL pipeline

Scripts under `scripts/intelligence-etl/` and `lib/intelligence/`:

1. **Parse** — blank-row filter, money/percent parsers, column harmonization across 2023–2026 sheets
2. **Entity resolution** — fuzzy match to live `groups`, `clients`, `brands`, `influencers` (read-only)
3. **Warehouse load** — upsert into `int_*` tables; identity merge for sparse influencer rows
4. **Benchmarks** — aggregate by platform × category × market × tier × year

```bash
npm run intelligence:etl              # full load
npm run intelligence:etl:dry-run    # parse + resolve, no writes
npm run intelligence:preload-audit    # pre-load quality report
npm run intelligence:final-reconciliation
npm run intelligence:audit-2023
npm run intelligence:test-parsers
```

See also: [`INTELLIGENCE_ETL.md`](./INTELLIGENCE_ETL.md)

### UI workspace (`/intelligence`)

| Tab | Content |
| --- | --- |
| **Influencer Intelligence** | Top 25 vendors by campaign count, median cost/margin |
| **Campaign Benchmarking** | Benchmark slices by platform/category/market/tier |
| **Margin Protection** | Lines below 15% margin threshold |

KPI strip: historical revenue, campaign lines, vendors, benchmark slices, median margin, sub-15% line count.

**Reconciled headline totals** (post-ETL, user-confirmed):

| Metric | Value |
| --- | ---: |
| Historical revenue | **$85.1M** |
| Campaign lines | **27,364** |
| Warehouse vendors | **11,504** |
| Benchmark slices | **253** |

### Performance RPCs (timeout fixes)

PostgREST table scans on large warehouse tables caused `statement_timeout` under authenticated RLS. Replaced with SECURITY DEFINER RPCs:

| RPC | Migration | Replaces |
| --- | --- | --- |
| `get_workspace_counts` | `20260624010000_intelligence_workspace_stats.sql` | Q1/Q2/Q3/Q5 head counts |
| `get_campaign_financial_totals` | same | Revenue/cost/GP sum |
| `get_margin_median` | `20260624020000_intelligence_margin_median_rpc.sql` | Q4 margin row fetch |
| `get_top_influencers` | `20260624030000_intelligence_top_influencers_rpc.sql` | Q6 join + JS aggregation |
| `get_low_margin_line_count` | `20260624040000_intelligence_margin_alerts_rpc.sql` | Q8 KPI count |
| `get_margin_alerts` | same | Q8 margin tab rows |

Fix documentation:

- [`INTELLIGENCE_Q4_TIMEOUT_FIX.md`](./INTELLIGENCE_Q4_TIMEOUT_FIX.md)
- [`INTELLIGENCE_Q6_TIMEOUT_FIX.md`](./INTELLIGENCE_Q6_TIMEOUT_FIX.md)
- [`INTELLIGENCE_Q8_TIMEOUT_FIX.md`](./INTELLIGENCE_Q8_TIMEOUT_FIX.md)

---

## Current status

| Area | Status |
| --- | --- |
| **Production nav** | Hidden — Insights → Intelligence link gated by `INTELLIGENCE_ARCHIVED` |
| **Route `/intelligence`** | Redirects to `/campaigns` when archived |
| **Warehouse data** | Intact — no schema or data changes as part of archive |
| **ETL scripts** | Available — `npm run intelligence:etl` still works locally |
| **Migrations** | Applied / available — no rollback |
| **Match % KPI** | Low (0.02% / 2 of 11,504) — sparse operational masters, not a UI bug |
| **Timeout fixes** | Q4/Q6/Q8 RPC migrations applied in codebase |

### Known limitations at archive time

- **Match confidence** — only 2 warehouse influencers matched operational masters (5 vendors, 9 handles). All 7,203 campaign-linked rows show 0% match. See [`INTELLIGENCE_MATCH_COVERAGE_REPORT.md`](./INTELLIGENCE_MATCH_COVERAGE_REPORT.md).
- **Diagnostic history** — full post-fix investigation in [`INTELLIGENCE_FINAL_DIAGNOSTIC.md`](./INTELLIGENCE_FINAL_DIAGNOSTIC.md).
- **Data completeness** — [`INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md`](./INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md)
- **UI diagnostic** — [`INTELLIGENCE_UI_DIAGNOSTIC.md`](./INTELLIGENCE_UI_DIAGNOSTIC.md)

---

## How to re-enable

### 1. Flip the feature flag

In `lib/intelligence/feature-flag.ts`:

```typescript
export const INTELLIGENCE_ARCHIVED = false;  // was true
```

This is the single source of truth. It restores the sidebar link and allows `/intelligence` to render.

### 2. Redeploy

Deploy the flag change to production. No migration or ETL run is required if warehouse data is already loaded.

### 3. Verify locally (optional)

```bash
# Ensure migrations are applied
supabase db push

# Refresh warehouse data if needed
npm run intelligence:etl

# Start dev server and open /intelligence
npm run dev
```

### 4. Confirm UI

- Sidebar: **Insights → Intelligence** visible
- KPIs: revenue ~$85.1M, lines ~27k, vendors ~11.5k, benchmarks ~253
- No amber timeout banner (Q4/Q6/Q8 RPCs deployed)
- Match % still low until operational master data grows

---

## Related documentation

| Doc | Topic |
| --- | --- |
| [`INTELLIGENCE_ETL.md`](./INTELLIGENCE_ETL.md) | ETL prerequisites and pipeline |
| [`INTELLIGENCE_FINAL_DIAGNOSTIC.md`](./INTELLIGENCE_FINAL_DIAGNOSTIC.md) | Post-fix timeout + match % investigation |
| [`INTELLIGENCE_MATCH_COVERAGE_REPORT.md`](./INTELLIGENCE_MATCH_COVERAGE_REPORT.md) | Entity-resolution match coverage |
| [`INTELLIGENCE_Q4_TIMEOUT_FIX.md`](./INTELLIGENCE_Q4_TIMEOUT_FIX.md) | Median margin RPC |
| [`INTELLIGENCE_Q6_TIMEOUT_FIX.md`](./INTELLIGENCE_Q6_TIMEOUT_FIX.md) | Top influencers RPC |
| [`INTELLIGENCE_Q8_TIMEOUT_FIX.md`](./INTELLIGENCE_Q8_TIMEOUT_FIX.md) | Margin alerts RPC |
| [`INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md`](./INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md) | Warehouse field coverage |
| [`INTELLIGENCE_FIX_IMPLEMENTATION_PLAN.md`](./INTELLIGENCE_FIX_IMPLEMENTATION_PLAN.md) | P1–P4 fix plan |
| [`INTELLIGENCE_FINAL_RECONCILIATION.md`](./INTELLIGENCE_FINAL_RECONCILIATION.md) | Pre-ETL sign-off totals |

---

## Code map (unchanged by archive)

```
app/(dashboard)/intelligence/     # Route (gated)
features/intelligence/            # Workspace UI + queries
lib/intelligence/                 # Parsers, ETL helpers, entity resolution, feature flag
scripts/intelligence-etl/         # ETL runner and audits
scripts/intelligence-*.ts         # Timing and match-coverage diagnostics
supabase/migrations/*intelligence*  # Schema + RPC migrations
types/intelligence.ts             # Warehouse types
```
