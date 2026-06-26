# Engagement Rate Engine

Canonical module: `lib/performance/engagement-rate-engine.ts`

All UI surfaces (Publication Workspace, Performance Grid, dashboards, PDF/Excel/CSV exports) must derive engagement totals and engagement rate (ER) from this engine or from DB columns populated by the metrics collector using the same logic.

## Engagements

```
engagements =
  COALESCE(likes, 0)
+ COALESCE(comments, 0)
+ COALESCE(shares, 0)
+ COALESCE(saves, 0)
```

Negative values and `-1` (hidden/unavailable from providers) are treated as absent before summing.

## Engagement rate priority

Denominator priority (first match wins):

| Priority | Condition | Formula | `engagement_rate_method` |
|----------|-----------|---------|-------------------------|
| 1 | `views > 0` | `engagements / views × 100` | `views` |
| 2 | `reach > 0` | `engagements / reach × 100` | `reach` |
| 3 | `creator followers > 0` | `engagements / followers × 100` | `followers` |
| 4 | Manual ER override set | stored override | `manual` |
| 5 | Otherwise | `NULL` | `unknown` |

Manual ER override (`engagement_rate_method = 'manual'`) takes precedence over automatic denominators when a stored manual rate is present.

Impressions are **not** used as an ER denominator.

## Auto-recalculation

Whenever metrics change (API sync, screenshot extraction, CSV/Excel import, manual edit, restore automatic), the collector:

1. Merges incoming metrics with stored values (manual overrides win for fields provided).
2. Recomputes `engagements`, `engagement_rate`, and `engagement_rate_method`.
3. Persists all three to `campaign_publications`.

Example: followers-only ER when views are missing; after views arrive, method switches from `followers` → `views` automatically.

## Database columns

| Column | Description |
|--------|-------------|
| `engagements` | Sum of interaction metrics |
| `engagement_rate` | Percentage (e.g. `2.6` = 2.6%) |
| `engagement_rate_method` | `views`, `reach`, `followers`, `manual`, `unknown` |

Migration: `supabase/migrations/20260623180000_engagement_rate_method.sql`

## Manual metrics

Users may override views, reach, impressions, likes, comments, shares, and saves via:

- Publication Workspace → Manual metrics tab
- CSV import (`importPublicationMetricsAction`)
- Excel import (same pipeline)

Overrides set `metrics_provider = 'manual'`. **Restore automatic metrics** requeues collection with trigger `manual_restore_automatic`, clears stored overrides, and repopulates from providers.

Metrics source badges:

| Badge | When |
|-------|------|
| Automatic | Provider-synced metrics, no manual override |
| Manual | All metrics manual or manual ER override |
| Mixed | `metrics_provider = manual` but ER still computed from views/reach/followers |

## Instagram edge cases

**Photo / carousel without public views**

- Do **not** mark refresh status as `partial` solely because views are missing.
- Mark **completed** when `likes > 0` OR `comments > 0`.
- UI notice: *"Instagram does not publicly expose view counts for this content type."*

**Hidden likes**

- Provider may return `-1` for hidden like counts.
- UI notice: *"Likes hidden by creator"* when raw value is `-1` or likes are null but other engagement exists.
- Sync does not fail.

## UI display

Publication Workspace shows:

```
ER: 2.6%
Method: Views
```

With tooltip on follower-based ER: *"Engagement rate is currently calculated using follower count because view data is unavailable."*

## Integration points

| Layer | File |
|-------|------|
| Engine | `lib/performance/engagement-rate-engine.ts` |
| Merge / persist | `lib/performance/metrics-collector/merge-metrics.ts`, `persist.ts` |
| Legacy calcs | `lib/campaigns/performance-calculations.ts` (delegates to engine) |
| Query mapping | `features/campaigns/queries/publications.ts` |
| Workspace UI | `publication-workspace/engagement-rate-display.tsx` |
| Tests | `lib/performance/engagement-rate-engine.test.ts` |

Run tests:

```bash
npm run test:engagement-rate-engine
npm run test:engagement-rate-audit
npm run test:metrics-collector
```

## ER recalculation audit

Whenever metrics are persisted and engagement rate or method changes, an audit row is written to `publication_metric_sync_logs`:

| Field | Description |
|-------|-------------|
| `status` | `er_recalculated` |
| `provider` | `engagement_engine` |
| `message` | Human-readable reason (e.g. method switch) |
| `previous_er` / `new_er` | ER (%) before and after |
| `previous_method` / `new_method` | Denominator method before and after |
| `triggered_by` | Sync trigger (`manual_refresh`, `manual`, `manual_restore_automatic`, etc.) |

Example messages:

- *ER recalculated using Followers because views are unavailable.*
- *ER recalculated using Views after automatic sync.*
- *Manual metrics override applied.*
- *Automatic metrics restored.*

Migration: `supabase/migrations/20260624140000_er_recalculation_audit.sql`

Module: `lib/performance/engagement-rate-audit.ts`
