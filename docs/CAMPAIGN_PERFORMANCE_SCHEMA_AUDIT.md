# Campaign Performance Schema Audit

**Date:** June 2026  
**Table:** `public.campaign_publications`  
**Application module:** Campaign Performance Center (`?tab=publications`)

## Summary

Production reported:

```text
column campaign_publications.engagement_views does not exist
```

The Performance Center query previously selected a **fixed column list** including legacy `engagement_*` fields. Production had a **partial table** (created without the full `20260531400000` migration), so PostgREST failed before any UI could render.

### Compatibility status

| Layer | Status after fix |
|--------|------------------|
| **Query layer** | Schema-validated `SELECT` — only queries columns that exist |
| **UI** | Shows `—` for null metrics; charts use empty states |
| **Writes** | `filterWritePayload()` strips unknown columns |
| **Database** | Apply `20260623120000_campaign_publications_full_schema_reconcile.sql` for full metrics |

Run verification:

```bash
npm run verify:campaign-performance
```

---

## Fields audited (application)

### Core / grid / exports

| Column | Used by |
|--------|---------|
| `id`, `campaign_header_id` | Grid, drawer, exports |
| `campaign_line_id`, `assignment_deliverable_id`, `assignment_post_schedule_id` | Linkage |
| `influencer_id` | Creator column, KPI top creator |
| `platform`, `publication_type` | Grid, charts (platform/type split) |
| `content_url` | Grid actions, media preview |
| `publication_date`, `status`, `created_at` | Grid, charts over time |
| `caption`, `hashtags`, `mentions`, `thumbnail_url`, `notes` | Drawer, search |

### Core metrics

| Column | KPI | Grid | Charts | Reports |
|--------|-----|------|--------|---------|
| `impressions` | ✓ | ✓ | ✓ | ✓ |
| `reach` | ✓ | ✓ | ✓ | ✓ |
| `views` | ✓ | ✓ | ✓ | ✓ |
| `unique_views` | — | drawer | — | — |

### Engagement metrics

| Column | KPI | Grid | Charts |
|--------|-----|------|--------|
| `likes`, `comments`, `shares`, `saves`, `clicks` | ✓ (engagements) | ✓ | ✓ |

### Video metrics

| Column | App field | Notes |
|--------|-----------|--------|
| `watch_time_seconds` | `watch_time` in spec | Stored as seconds |
| `average_watch_time_seconds` | `average_watch_time` | Stored as seconds |
| `plays`, `completion_rate` | Drawer audience tab | |

### Calculated metrics

| Column | Behavior |
|--------|----------|
| `engagement_rate`, `view_rate`, `cpm`, `cpv`, `cpe`, `cpc` | Stored if present; otherwise derived in app from raw metrics + `cost` |
| `cost`, `currency` | Grid CPV/CPE, KPI CPM/CPV |

### AI metrics

| Column | Drawer |
|--------|--------|
| `sentiment_score`, `brand_safety_score`, `authenticity_score` | AI Insights tab |

### Sync fields

| Column | Purpose |
|--------|---------|
| `last_synced_at`, `sync_status`, `sync_source` | History + bulk sync queue |
| `api_sync_status`, `detection_source` | Legacy aliases (read fallback) |

### Legacy engagement columns

| Column | Purpose |
|--------|---------|
| `engagement_views`, `engagement_likes`, `engagement_comments`, `engagement_shares` | Fallback when canonical `views`/`likes`/… absent; **optional** in queries |

---

## Existing columns (canonical migrations)

### `20260531400000_campaign_publications.sql`

Base table including `engagement_*`, `api_sync_status`, `detection_source`, etc.

### `20260622130000_campaign_performance_center.sql`

Performance metrics (`impressions`, `reach`, `views`, …), `sync_status`, `sync_source`, RLS.

### `20260623120000_campaign_publications_full_schema_reconcile.sql` (generated)

- `ADD COLUMN IF NOT EXISTS` for **all** app columns including legacy `engagement_*`
- Backfill `views` ← `engagement_views` when both exist
- `list_public_table_columns(text)` RPC for runtime + verify script
- Idempotent indexes + RLS

---

## Missing columns (typical partial production)

Observed failure: **`engagement_views`** (and likely other legacy + metric columns).

After reconcile migration, expected state: **all columns in `CAMPAIGN_PUBLICATIONS_ALL_APP_COLUMNS` present**.

---

## Application changes

| File | Change |
|------|--------|
| `lib/campaigns/campaign-publications-schema.ts` | Canonical column manifest |
| `lib/campaigns/campaign-publications-schema-runtime.ts` | RPC/probe + cached dynamic `SELECT` |
| `features/campaigns/queries/publications.ts` | Schema-aware load; `schema_warnings` |
| `features/campaigns/actions/performance-actions.ts` | Filter writes to existing columns |
| `scripts/verify-campaign-performance-schema.ts` | CI/ops verification |
| `package.json` | `verify:campaign-performance` script |

---

## Deployment checklist

1. Deploy application code (schema-aware queries).
2. Apply migration:
   ```bash
   npx supabase db push --include-all
   ```
3. Verify:
   ```bash
   npm run verify:campaign-performance
   ```
4. Hard-refresh campaign Performance tab.

---

## Graceful degradation

- **Missing metric columns:** Publications load; KPIs/charts show zeros/`—`; non-blocking banner.
- **Missing required columns:** Blocking error with migration name.
- **No runtime crashes:** Partial rows mapped with null coalescing + derived metrics.
