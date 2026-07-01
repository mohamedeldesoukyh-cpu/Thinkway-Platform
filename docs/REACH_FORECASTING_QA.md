# Reach Forecasting QA

## Preconditions

- Apply migration `20260630130000_reach_forecasting.sql`
- Campaign with publications linked to influencers that have `influencer_platform_accounts.follower_count`

## Scenarios

### 1. Forecast when provider has no reach

1. Open a publication where the provider returns likes/views but not reach.
2. Refresh metrics.
3. **Expected:** `reach_source = forecast`, reach ≈ followers × multiplier, amber Forecast badge in grid.

### 2. Actual overrides forecast

1. Start from a forecasted publication (scenario 1).
2. Trigger a provider sync that returns reach (or manually restore automatic after provider fix).
3. **Expected:** `reach_source = actual`, `actual_reach` set, `forecast_reach` preserved, workspace shows “Forecast used previously: XK”.

### 3. Manual reach

1. Open publication workspace → Manual metrics.
2. Enter reach only, save.
3. **Expected:** `reach_source = manual`, blue Manual badge.

### 4. Campaign totals

1. Open Performance Center KPI strip.
2. **Expected:** Total Reach includes forecast rows; subtext shows Actual vs Forecast breakdown.

### 5. Reports

1. Export HTML/PDF, Excel, PPTX.
2. **Expected:** Reach Source column per publication; summary disclaimer and actual/forecast breakdown.

### 6. Audit log

1. Transition forecast → actual.
2. Open Metrics history / `publication_metric_sync_logs`.
3. **Expected:** `reach_source_changed` entry with `old_source`, `new_source`, `old_value`, `new_value` in `response_summary`.

## Automated tests

```bash
npm run test:reach-forecast-engine
npm run test:metrics-collector
npm run test:engagement-rate-engine
```
