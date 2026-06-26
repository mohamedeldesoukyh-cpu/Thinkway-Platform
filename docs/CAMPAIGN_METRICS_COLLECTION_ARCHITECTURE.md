# Campaign Metrics Collection Architecture

## Purpose

Every publication in **Campaign Performance** must attempt automated metrics collection from multiple sources. When automation cannot produce a complete dataset, the platform falls back to **manual CSV/Excel import** so client reports can still be generated.

Accuracy and completeness take priority over speed.

---

## High-level pipeline

```
Publication URL (+ platform field)
  → detect platform + media id
  → try official API
  → try external provider (Bright Data)
  → try Apify scraper actor
  → try Playwright extraction (worker runtime only)
  → if no metrics: metrics_refresh_status = manual_required
  → persist metrics + publication_metric_sync_logs
```

Implementation: `lib/performance/metrics-collector/`

| Module | Role |
|--------|------|
| `detect-platform.ts` | URL/platform detection, provider chain order |
| `collect-publication-metrics.ts` | Orchestration entry points (single, bulk, cron) |
| `merge-metrics.ts` | Merge partial results; compute engagements + ER |
| `persist.ts` | Write `campaign_publications` + sync logs |
| `providers/*` | Provider adapters (Meta, YouTube, Apify, …) |
| `import-metrics-rows.ts` | Manual CSV/Excel row parsing |

---

## Supported platforms

| Platform | Provider priority |
|----------|-------------------|
| Instagram | Meta Graph API → Bright Data → Apify → Playwright |
| TikTok | TikTok API → Apify → Playwright |
| YouTube | YouTube Data API |
| Facebook | Facebook Graph API → Bright Data → Apify → Playwright |
| Snapchat | Snapchat API → Apify → Playwright |

---

## Database

### `campaign_publications` (new columns)

| Column | Values / notes |
|--------|----------------|
| `metrics_refresh_status` | `pending`, `collecting`, `completed`, `manual_required`, `failed` |
| `metrics_refresh_attempted_at` | Last collection attempt |
| `metrics_collection_source` | Winning provider id (e.g. `youtube_data_api`, `manual_import`) |
| `engagements` | Stored total (likes + comments + shares + saves) |

Migration: `supabase/migrations/20260624120000_campaign_metrics_collection.sql`

### `publication_metric_sync_logs`

Audit trail per provider attempt:

- `publication_id`, `campaign_header_id`
- `provider`, `attempt_order`, `status`, `message`, `error_code`
- `metrics_snapshot` (jsonb)
- `triggered_by` (`auto_create`, `manual_refresh`, `bulk_refresh`, `scheduled_cron`, `manual_import`)

---

## Triggers

| Trigger | When |
|---------|------|
| `auto_create` | New publication with `content_url` (`createCampaignPublicationAction`) |
| `manual_refresh` | Row ⋯ menu or detail drawer **Refresh metrics** |
| `bulk_refresh` | Selected rows or **Refresh all metrics** (campaign header) |
| `scheduled_cron` | Vercel cron `GET /api/cron/publication-metrics` daily (02:00 UTC) |
| `manual_import` | **Import metrics CSV/Excel** on Performance tab |

Cron auth: `Authorization: Bearer $CRON_SECRET` (skipped in development if unset).

---

## Environment variables

| Variable | Provider |
|----------|----------|
| `META_GRAPH_ACCESS_TOKEN` | Instagram / Facebook Graph |
| `FACEBOOK_GRAPH_ACCESS_TOKEN` | Facebook (optional override) |
| `YOUTUBE_API_KEY` | YouTube Data API |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | TikTok official (licence required) |
| `BRIGHTDATA_API_KEY` / `BRIGHTDATA_INSTAGRAM_DATASET_ID` | Bright Data |
| `APIFY_TOKEN` / `APIFY_*_ACTOR_ID` | Apify scrapers |
| `SNAPCHAT_API_KEY` | Snapchat Marketing API |
| `METRICS_PLAYWRIGHT_ENABLED=true` | Enable Playwright path on worker runtime |
| `CRON_SECRET` | Scheduled refresh route |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron + admin persistence |

Missing credentials skip a provider and log `skipped` in `publication_metric_sync_logs`.

---

## Server actions

`features/campaigns/actions/performance-actions.ts`

- `refreshPublicationMetricsAction` — single publication
- `refreshCampaignMetricsAction` — bulk / entire campaign
- `importPublicationMetricsAction` — row array (CSV parsed client-side)
- `importPublicationMetricsFileAction` — CSV or `.xlsx` upload
- `requestPublicationMetricsSyncAction` — legacy name; runs real collection

---

## Manual import fallback

Required columns (any alias): `publication_id` or `content_url` to match a row, plus metric columns (`views`, `reach`, `impressions`, `likes`, `comments`, `shares`, `saves`, `engagements`, `engagement_rate`, …).

On success:

- Metrics persisted with `metrics_refresh_status = completed`
- `metrics_collection_source = manual_import`

This guarantees client-ready reports even when APIs/scrapers fail.

---

## UI (Performance Center)

- Grid **Metrics** column shows `metrics_refresh_status`
- Row ⋯ → **Refresh metrics**
- Detail drawer → **Refresh metrics**
- Header → **Refresh all metrics**
- Bulk selection bar → **Refresh metrics**
- **Import metrics CSV** (and `.xlsx` via server file action)

---

## Scheduled job

`vercel.json`:

```json
"crons": [{ "path": "/api/cron/publication-metrics", "schedule": "0 2 * * *" }]
```

Processes up to 50 publications per run where:

- `content_url` is set
- Never attempted, status `pending`/`failed`, or last attempt &gt; 24h ago

---

## Operational notes

1. **Playwright** is not run inside Next.js serverless functions; enable on a long-running worker when `METRICS_PLAYWRIGHT_ENABLED=true`.
2. **TikTok / Snapchat official APIs** require platform partnerships; pipeline falls through to Apify/manual import.
3. **Bright Data** trigger API may return async jobs; adapter stores partial sync — re-run refresh after dataset completion.
4. Run migration before deploy: `npx supabase db push --include-all`
5. Tests: `node --import tsx lib/performance/metrics-collector/metrics-collector.test.ts`

---

## Future extensions

- Queue long-running Apify/Bright Data jobs via BullMQ (pattern: `services/discovery-worker`)
- Per-brand Meta Business asset mapping for Graph API media ids
- Webhook callback when external provider completes
- Metrics freshness SLA dashboard from `publication_metric_sync_logs`
