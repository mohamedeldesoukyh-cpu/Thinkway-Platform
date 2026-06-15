# Intelligence Go-Live Checklist

> **Purpose:** Pre-flight and post-load validation for the historical intelligence warehouse.  
> **Source audit:** [`INTELLIGENCE_PRELOAD_AUDIT.md`](./INTELLIGENCE_PRELOAD_AUDIT.md) (refreshed 2026-06-15, header normalization applied)  
> **Revenue detail:** [`INTELLIGENCE_REVENUE_RECONCILIATION.md`](./INTELLIGENCE_REVENUE_RECONCILIATION.md)  
> **Workbook:** `data 2023 - 2026.xlsx` · **Schema:** `intelligence` only — **never** `public.campaign_headers`, invoices, or billing tables.

---

## Comparison vs prior baseline (2026-06-15, pre–header-normalization)

| Metric | Pre-fix harmonizer | **Current (post-fix)** | Δ |
| --- | ---: | ---: | ---: |
| Total revenue | $61,946,545 | **$85,144,691** | +$23,198,146 |
| Total cost | $65,909,393 | $65,909,393 | $0 |
| Margin / GP | -$3,962,848 | **$19,235,298** | +$23,198,146 |
| Margin % | -6.4% | **22.6%** | +29.0 pp |
| 2023 revenue | $0 | **$23,198,146** | +$23,198,146 |
| Harmonized campaign lines | 27,364 | 27,364 | 0 |
| Clients | 197 | 197 | 0 |
| Brands | 318 | 318 | 0 |
| Influencers | 15,509 | 15,509 | 0 |

> **2023 whitespace fix applied:** `normalizeExcelHeader` resolves `" Revenue ($) ROI "` and similar variants — see [`INTELLIGENCE_REVENUE_RECONCILIATION.md`](./INTELLIGENCE_REVENUE_RECONCILIATION.md).

---

## Pre-load baseline (harmonized Excel dry-run)

Use these numbers to validate the warehouse after ETL. Re-generate anytime:

```bash
INTELLIGENCE_ETL_DRY_RUN=1 npm run intelligence:preload-audit
```

| Metric | Expected value |
| --- | ---: |
| Filtered data rows (campaign sheets + Database) | 35,743 |
| Harmonized campaign lines | 27,364 |
| Blank layout rows removed | 16,832 (32.0% of raw) |
| **Total revenue (USD)** | **$85,144,691** |
| **Total cost (USD)** | **$65,909,393** |
| **Total margin / GP (USD)** | **$19,235,298** |
| **Margin % (GP ÷ revenue)** | **22.6%** |

> GP = Rev − Cost (historical semantics; no UR/AF split). See [`INTELLIGENCE_ETL.md`](./INTELLIGENCE_ETL.md).

---

## Expected warehouse row counts (post full load)

Counts from preload audit — warehouse totals must match **±0** after load.

| Table | Expected rows |
| --- | ---: |
| `intelligence.historical_campaigns_raw` | 27,364 |
| `intelligence.historical_influencers_raw` | 8,379 |
| `intelligence.int_campaigns` | 27,364 |
| `intelligence.int_clients` | 197 |
| `intelligence.int_brands` | 318 |
| `intelligence.int_influencers` | 15,509 |
| `intelligence.int_pricing_history` | 26,710 |
| `intelligence.int_margin_history` | 27,347 |
| `intelligence.int_benchmarks` | 253 |

**Reference client (top by revenue):** L'Oréal Middle East FZE — **$17,816,288** revenue, 8,313 lines.

---

## Pre-flight checklist

- [ ] Migration applied: `supabase/migrations/20260623010000_intelligence_warehouse.sql` (+ grants fix if present)
- [ ] `.env` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (JWT `eyJ…`, not `sb_secret_*`)
- [ ] Excel path confirmed (`INTELLIGENCE_EXCEL_PATH` or default in [`INTELLIGENCE_ETL.md`](./INTELLIGENCE_ETL.md))
- [ ] Preload audit re-run and headline totals match table above
- [ ] **2023 header normalization verified** — 2023 revenue ~$23.2M ([`INTELLIGENCE_REVENUE_RECONCILIATION.md`](./INTELLIGENCE_REVENUE_RECONCILIATION.md))
- [ ] Parser tests pass: `npm run intelligence:test-parsers`
- [ ] Dry-run completes without error: `npm run intelligence:etl:dry-run`
- [ ] Stakeholder sign-off on duplicate influencer keys (3,163 keys; expected at line grain)
- [ ] Stakeholder sign-off on headline margin (**22.6%**)
- [ ] Rollback SQL reviewed and saved (see below)
- [ ] Operational table row counts recorded **before** load (for diff check)

---

## ETL runtime estimate

Measured locally (2026-06-15, ~36k filtered rows, ~27k campaigns):

| Phase | Measured / estimated |
| --- | --- |
| Parse + harmonize + benchmarks (dry-run, no DB) | **~40 s** |
| Entity resolution (read live masters) | ~30–60 s |
| Warehouse upserts (~110k total rows, batch 500) | ~5–12 min |
| **Full load (typical)** | **~6–14 min** |
| **Full reload with truncate** | **~8–16 min** |

Factors: Supabase latency, network, and whether `INTELLIGENCE_ETL_TRUNCATE=1` clears existing rows first.

### Run commands

**First load:**

```bash
npm run intelligence:etl
```

**Full reload (truncate warehouse first):**

```bash
# PowerShell
$env:INTELLIGENCE_ETL_TRUNCATE="1"; npm run intelligence:etl

# Bash / Git Bash
INTELLIGENCE_ETL_TRUNCATE=1 npm run intelligence:etl
```

---

## Rollback procedure (intelligence schema only)

### Critical rule

**Never truncate or delete from operational tables:** `public.campaign_headers`, `public.campaign_lines`, `public.campaign_influencers`, `public.invoices`, `public.clients`, `public.brands`, `public.influencers`, or any billing / IO / payment table.

The ETL writes **only** to `intelligence.*`. Rollback clears the warehouse so you can re-run a clean load.

### Option A — ETL built-in truncate (before reload)

Set `INTELLIGENCE_ETL_TRUNCATE=1` and run the ETL. The loader deletes all rows from these tables **in FK-safe order** (child facts first):

1. `int_benchmarks`
2. `int_margin_history`
3. `int_pricing_history`
4. `int_campaigns`
5. `int_brands`
6. `int_clients`
7. `int_influencers`
8. `historical_influencers_raw`
9. `historical_campaigns_raw`

Implementation: service-role `DELETE` where `id != '00000000-0000-0000-0000-000000000000'` per table (`scripts/intelligence-etl/run.ts`).

> **Note:** `entity_resolution_overrides` is **not** cleared by `INTELLIGENCE_ETL_TRUNCATE`. Clear manually if needed.

### Option B — SQL rollback (Supabase SQL Editor)

Run as a user with rights on `intelligence` schema. Copy-paste safe — touches **only** `intelligence` tables.

```sql
-- Intelligence warehouse rollback — DO NOT run against public.* tables
BEGIN;

TRUNCATE TABLE intelligence.int_benchmarks;
TRUNCATE TABLE intelligence.int_margin_history;
TRUNCATE TABLE intelligence.int_pricing_history;
TRUNCATE TABLE intelligence.int_campaigns;
TRUNCATE TABLE intelligence.int_brands;
TRUNCATE TABLE intelligence.int_clients;
TRUNCATE TABLE intelligence.int_influencers;
TRUNCATE TABLE intelligence.historical_influencers_raw;
TRUNCATE TABLE intelligence.historical_campaigns_raw;

-- Optional: clear manual entity-resolution overrides
-- TRUNCATE TABLE intelligence.entity_resolution_overrides;

COMMIT;
```

After rollback, all intelligence tables should return **0** rows from the validation queries below.

---

## Post-load validation SQL (read-only)

Run in **Supabase SQL Editor** after ETL completes.

### 1. Row count per intelligence table

```sql
SELECT 'historical_campaigns_raw' AS tbl, COUNT(*) AS cnt FROM intelligence.historical_campaigns_raw
UNION ALL SELECT 'historical_influencers_raw', COUNT(*) FROM intelligence.historical_influencers_raw
UNION ALL SELECT 'int_campaigns', COUNT(*) FROM intelligence.int_campaigns
UNION ALL SELECT 'int_clients', COUNT(*) FROM intelligence.int_clients
UNION ALL SELECT 'int_brands', COUNT(*) FROM intelligence.int_brands
UNION ALL SELECT 'int_influencers', COUNT(*) FROM intelligence.int_influencers
UNION ALL SELECT 'int_pricing_history', COUNT(*) FROM intelligence.int_pricing_history
UNION ALL SELECT 'int_margin_history', COUNT(*) FROM intelligence.int_margin_history
UNION ALL SELECT 'int_benchmarks', COUNT(*) FROM intelligence.int_benchmarks
ORDER BY tbl;
```

**Expected:** counts match [Expected warehouse row counts](#expected-warehouse-row-counts-post-full-load) exactly (±0).

### 2. Revenue / cost / margin on `int_campaigns`

```sql
SELECT
  COUNT(*) AS line_count,
  ROUND(SUM(revenue_usd)::numeric, 0) AS total_revenue_usd,
  ROUND(SUM(cost_usd)::numeric, 0) AS total_cost_usd,
  ROUND(SUM(COALESCE(gp_usd, revenue_usd - cost_usd))::numeric, 0) AS total_gp_usd,
  ROUND(
    100.0 * SUM(COALESCE(gp_usd, revenue_usd - cost_usd)) / NULLIF(SUM(revenue_usd), 0),
    1
  ) AS margin_pct
FROM intelligence.int_campaigns;
```

**Expected:** 27,364 lines · **$85,144,691** revenue · **$65,909,393** cost · **$19,235,298** GP · **22.6%** margin.

### 3. Benchmark slice count

```sql
SELECT COUNT(*) AS benchmark_slices FROM intelligence.int_benchmarks;
```

**Expected:** **253**.

### 4. Sample — top client by revenue

```sql
SELECT
  c.client_name_raw,
  c.group_name_raw,
  ROUND(SUM(ic.revenue_usd)::numeric, 0) AS revenue_usd,
  ROUND(SUM(ic.cost_usd)::numeric, 0) AS cost_usd,
  COUNT(*) AS lines
FROM intelligence.int_campaigns ic
JOIN intelligence.int_clients c ON c.id = ic.int_client_id
GROUP BY c.id, c.client_name_raw, c.group_name_raw
ORDER BY SUM(ic.revenue_usd) DESC NULLS LAST
LIMIT 5;
```

**Expected #1:** L'Oréal Middle East FZE · L'Oréal · **$17,816,288** revenue · 8,313 lines.

### 5. Operational tables unchanged (sanity check)

Record counts before and after load; they must be **identical**.

```sql
SELECT 'campaign_headers' AS tbl, COUNT(*) AS cnt FROM public.campaign_headers
UNION ALL SELECT 'campaign_lines', COUNT(*) FROM public.campaign_lines
UNION ALL SELECT 'invoices', COUNT(*) FROM public.invoices
ORDER BY tbl;
```

---

## UI validation

Open **`/intelligence`** (sidebar: Insights → Intelligence). Requires `intelligence.read` or `campaigns.read`.

- [ ] Page loads without error (no empty-state warnings if data loaded)
- [ ] KPI strip shows non-zero **Historical revenue**, **Vendors**, **Benchmark slices**
- [ ] **Influencer Intelligence** tab — top influencers table populated
- [ ] **Campaign Benchmarking** tab — benchmark slices table (~253 rows)
- [ ] **Margin Protection** tab — sub-15% margin alerts listed
- [ ] Tab deep links work: `/intelligence?tab=influencers`, `?tab=benchmarks`, `?tab=margin`

---

## Success criteria (sign-off)

- [ ] All warehouse table counts match preload audit **±0**
- [ ] `int_campaigns` revenue/cost/margin sums match Excel harmonized totals (±$1 rounding)
- [ ] `int_benchmarks` = **253** rows
- [ ] Top client spot-check matches L'Oréal Middle East FZE (~$17.8M)
- [ ] **`/intelligence` loads** and all **three tabs** show data
- [ ] **No changes** to `public.campaign_headers`, `campaign_lines`, `invoices`, or other operational tables
- [ ] **RLS:** authenticated user with permission can SELECT; user without permission cannot see warehouse rows
- [ ] ETL log ends with `[intelligence-etl] Complete.` and no thrown errors
- [ ] Rollback script tested on dev (optional but recommended before prod)

---

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Count mismatch vs audit | Stale partial load | Run rollback SQL, then `INTELLIGENCE_ETL_TRUNCATE=1` + full ETL |
| Permission denied on `intelligence.*` | Grants migration not applied | Apply `20260623020000_intelligence_schema_grants_fix.sql` |
| UI empty, SQL counts OK | Missing `intelligence.read` / RLS | Grant permission; verify `intelligence.can_read_intelligence()` |
| Revenue sum off by small amount | Rounding on individual lines | Accept if within $1; investigate if >0.1% |
| Negative margin in KPIs | Stale load or missing 2023 revenue | Re-run preload audit; confirm 2023 ~$23.2M ([`INTELLIGENCE_REVENUE_RECONCILIATION.md`](./INTELLIGENCE_REVENUE_RECONCILIATION.md)) |
| ETL slow (>20 min) | Network / Supabase throttling | Retry off-peak; check batch errors in console |

---

## References

- [`INTELLIGENCE_PRELOAD_AUDIT.md`](./INTELLIGENCE_PRELOAD_AUDIT.md) — volume, duplicates, rankings
- [`INTELLIGENCE_REVENUE_RECONCILIATION.md`](./INTELLIGENCE_REVENUE_RECONCILIATION.md) — year/sheet revenue, anomalies
- [`INTELLIGENCE_ETL.md`](./INTELLIGENCE_ETL.md) — env vars, run commands, isolation rules
- [`THINKWAY_INTELLIGENCE_ARCHITECTURE.md`](./THINKWAY_INTELLIGENCE_ARCHITECTURE.md) — schema design, feature context

**Refresh audit before go-live:**

```bash
INTELLIGENCE_ETL_DRY_RUN=1 npm run intelligence:preload-audit
```
