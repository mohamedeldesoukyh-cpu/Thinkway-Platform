# Thinkway Intelligence ETL

Phase 2 warehouse loader for historical Excel data (2023–2026). **Local dev only** — uses service role and writes to isolated `intelligence` schema.

## Prerequisites

1. Apply migration:

```bash
supabase db push
# or run supabase/migrations/20260623010000_intelligence_warehouse.sql on dev project
```

2. Environment (`.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | JWT `eyJ…` service role key (not `sb_secret_*`) |
| `INTELLIGENCE_EXCEL_PATH` | No | Override workbook path |
| `INTELLIGENCE_ETL_TRUNCATE` | No | Set `1` to clear warehouse tables before load |

Default Excel path:

```
c:\Users\X13 Yoga G3\Documents\Thinway\Thinkway Intelligence Engine\data 2023 - 2026.xlsx
```

## Run ETL

```bash
npx tsx scripts/intelligence-etl/run.ts
```

Full reload:

```bash
INTELLIGENCE_ETL_TRUNCATE=1 npx tsx scripts/intelligence-etl/run.ts
```

## Parser tests

```bash
npx tsx lib/intelligence/parsers/intelligence-parsers.test.ts
```

## Pipeline stages

1. **Raw load** — `historical_campaigns_raw`, `historical_influencers_raw` (JSONB payload preserved)
2. **Harmonize** — blank-row filter, money/percent parsers, column mapping across sheets
3. **Entity resolution** — fuzzy match to live `groups`, `clients`, `brands`, `influencers`, `campaign_headers` (read-only)
4. **Warehouse** — `int_clients`, `int_brands`, `int_influencers`, `int_campaigns`, `int_margin_history`, `int_pricing_history`
5. **Benchmarks** — `int_benchmarks` aggregated by platform × category × market × tier × year

## UI

Read-only dashboard: **`/intelligence`**

Tabs: Influencer Intelligence · Campaign Benchmarking · Margin Protection

RLS: `intelligence.read` or `campaigns.read` for internal authenticated users.

## Isolation

- No writes to `campaign_headers`, `campaign_lines`, `invoices`, IO, or billing tables
- Historical invoice numbers stored as reference only in `invoice_number_ref`
- GP semantics: **Rev − Cost** (not live billable Rev + UR + AF)

## Re-analyze Excel

```bash
node scripts/analyze-intelligence-excel.mjs
```

Output: `scripts/intelligence-excel-analysis.json`
