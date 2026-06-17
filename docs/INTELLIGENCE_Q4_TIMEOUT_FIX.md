# Intelligence Q4 Timeout Fix

> **Applied:** 2026-06-16 · Replaces Q4 `int_margin_history` row fetch with `get_margin_median()` SECURITY DEFINER RPC.

## Change summary

| Item | Before | After |
| --- | --- | --- |
| Q4 query | `int_margin_history.select("margin_pct").not(...).limit(5000)` | `rpc("get_margin_median")` |
| Median computation | JS `median()` on up to 1,000 PostgREST rows | SQL `percentile_disc(0.5)` on full non-null population |
| Migration | — | `20260624020000_intelligence_margin_median_rpc.sql` |

## Warehouse row counts (service role)

| Table / filter | Rows |
| --- | ---: |
| `int_margin_history` total | 27347 |
| `margin_pct IS NOT NULL` | 27220 |

## Timing (service role, 2026-06-15)

Service role bypasses RLS; authenticated sessions may differ. RPCs guarded by `can_read_intelligence()` return empty under service role.

| Query | ms | Rows / result |
| --- | ---: | --- |
| **Before** — Q4 old `marginRows` PostgREST fetch | 217 | 1000 rows returned (PostgREST default cap 1,000) |
| **After** — Q4 `get_margin_median` RPC | 221 | median = null (0 RPC row; empty under service role) |
| **After** — full 6-query `Promise.all` bundle | 467 | Q6=1000, Q7=50, Q8=40 |

### Bundle errors

None.
