# Intelligence Q8 Timeout Fix

> **Applied:** 2026-06-15 · Replaces Q8 `int_margin_history` ⋈ `int_campaigns` PostgREST join with `get_low_margin_line_count()` + `get_margin_alerts()` SECURITY DEFINER RPCs.

## Change summary

| Item | Before | After |
| --- | --- | --- |
| Q8 KPI count | `marginAlerts.data.length` (capped at 40, wrong if timeout) | `rpc("get_low_margin_line_count")` — full `count(*)` via partial index |
| Q8 tab rows | `int_margin_history.select(..., int_campaigns(...)).limit(40)` | `rpc("get_margin_alerts", { row_limit: 40 })` |
| Join logic | PostgREST embed join under RLS | SQL `JOIN int_campaigns` inside SECURITY DEFINER |
| Migration | — | `20260624040000_intelligence_margin_alerts_rpc.sql` |

## Warehouse verification

| Source | Below-threshold lines (`below_threshold_15pct = true`) |
| --- | ---: |
| Direct warehouse count (service role) | **11886** |
| `get_low_margin_line_count()` RPC (service role) | **0** (empty when `can_read_intelligence()` false) |
| UI before fix | **0** (timeout → empty `marginAlerts.data`) |

## Timing (service role, 2026-06-15)

Service role bypasses RLS; authenticated UI sessions may differ. RPCs guarded by `can_read_intelligence()` return empty under service role.

| Query | ms | Rows / result | Error |
| --- | ---: | --- | --- |
| Q-RPC1 `get_workspace_counts` | 216 | 0 RPC rows | — |
| Q-RPC2 `get_campaign_financial_totals` | 209 | 0 RPC rows | — |
| Q4 `get_margin_median` | 212 | median = null | — |
| Q6 `get_top_influencers` RPC | 193 | 0 rows | — |
| Q7 benchmarks | 220 | 50 rows | — |
| **Q8 old** margin alerts join | **417** | **40** rows | — |
| **Q8a new** `get_low_margin_line_count` | **87** | count = 0 | — |
| **Q8b new** `get_margin_alerts` | **205** | **0** rows | — |
| Full 7-query bundle (Q8 RPC) | 318 | count=0, alerts=0 | None |

## Expected UI outcome

- Amber **"[Q8] canceling statement due to statement timeout"** banner should disappear after deploy.
- **< 15% lines** KPI should show **11886** (warehouse actual), not 0.
- Margin Protection tab renders up to 40 lowest-margin alert rows (unchanged `MarginAlertRow` shape).
- Match % column unchanged (out of scope).
