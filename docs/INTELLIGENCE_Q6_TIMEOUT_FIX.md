# Intelligence Q6 Timeout Fix

> **Applied:** 2026-06-16 · Replaces Q6 `int_campaigns` ⋈ `int_influencers` join fetch with `get_top_influencers()` SECURITY DEFINER RPC.

## Change summary

| Item | Before | After |
| --- | --- | --- |
| Q6 query | `int_campaigns.select(..., int_influencers(...)).limit(8000)` + JS aggregation | `rpc("get_top_influencers", { row_limit: 25 })` |
| Top-25 logic | In-memory `Map` over PostgREST rows (max 1,000) | SQL `GROUP BY int_influencer_id ORDER BY count DESC LIMIT 25` |
| Median cost/margin | JS `median()` on joined row samples | SQL `percentile_disc(0.5)` on full per-influencer population |
| Migration | — | `20260624030000_intelligence_top_influencers_rpc.sql` |

## Timing (service role, 2026-06-15)

Service role bypasses RLS; authenticated UI sessions may differ. RPCs guarded by `can_read_intelligence()` return empty under service role.

### Confirmed timeout query

After Q4 `get_margin_median` fix (median KPI **20.0%** working), the remaining suspect is **Q6** — `int_campaigns` ⋈ `int_influencers` PostgREST join (`.limit(8000)`, effective cap 1,000 rows). Q-RPC1, Q-RPC2, Q4, Q7, and Q8 are ruled out by working KPIs/tab data.

| Query | ms | Rows / result | Error |
| --- | ---: | --- | --- |
| Q-RPC1 `get_workspace_counts` | 286 | 0 RPC rows | — |
| Q-RPC2 `get_campaign_financial_totals` | 198 | 0 RPC rows | — |
| Q4 `get_margin_median` | 85 | median = null | — |
| **Q6 old** join fetch | **220** | **1000** rows | — |
| Q7 benchmarks | 96 | 50 rows | — |
| Q8 margin alerts join | 141 | 40 rows | — |
| **Q6 new** `get_top_influencers` RPC | **96** | **0** rows | — |
| Full bundle (old Q6 join) | 286 | — | None |
| Full bundle (Q6 RPC) | 149 | top influencers = 0 | None |


## Expected UI outcome

- Amber **"canceling statement due to statement timeout"** banner should disappear after deploy (Q6 was the remaining failing query in the authenticated `Promise.all` bundle).
- Match % column unchanged (still reads `match_confidence` from warehouse; out of scope).
