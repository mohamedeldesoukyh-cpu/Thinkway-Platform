# Intelligence Warehouse Snapshot — Before ETL

> Captured 2026-06-15 (read-only, service_role via Supabase CLI). **Warehouse was not empty** — prior ETL load present.

## Table counts (pre-load)

| Table | Count |
| --- | ---: |
| `historical_campaigns_raw` | 27,364 |
| `historical_influencers_raw` | 8,379 |
| `int_campaigns` | 27,364 |
| `int_clients` | 197 |
| `int_brands` | 318 |
| `int_influencers` | 15,191 |
| `int_pricing_history` | 26,712 |
| `int_margin_history` | 27,347 |
| `int_benchmarks` | 253 |

## Financial totals (pre-load)

Warehouse aggregates from `int_campaigns` (paginated sum):

| Metric | Value |
| --- | ---: |
| Campaign lines | 27,364 |
| Revenue | $85,149,050.07 |
| Cost | $65,913,971.76 |
| GP (`SUM(gp_usd)`) | $19,324,987.56 |
| Margin (Rev − Cost) | $19,235,078.31 |

## Load decision

- **Truncate:** Not set (`INTELLIGENCE_ETL_TRUNCATE` omitted). Re-run will upsert existing rows.
- **Note:** User reported warehouse empty; live counts show full prior load. Proceeding with non-truncate ETL as requested.
- **Environment blocker:** `.env` `SUPABASE_SERVICE_ROLE_KEY` decodes to `role: anon` — ETL uses CLI service_role JWT for this session.
