# Production Metrics Collection

Phase 1 production readiness for Instagram, TikTok, and YouTube publications in Campaign Performance.

## Architecture

```
Publication URL added
  → queue status = queued (BullMQ publication-metrics)
  → discovery-worker runs metricsCollector()
      → detect platform
      → provider chain (priority order)
      → merge partial results
      → confidence scoring
      → persist + sync logs
  → manual CSV/Excel fallback if all providers fail
```

Core code: `lib/performance/metrics-collector/`  
Worker: `services/discovery-worker/src/workers/publication-metrics.worker.ts`

## Provider chains (Phase 1)

| Platform | Priority |
|----------|----------|
| Instagram | Apify → Meta Graph API → Bright Data → Playwright |
| TikTok | TikTok API → Apify → Playwright |
| YouTube | YouTube Data API → Apify → Public metadata |
| Facebook | Facebook Graph API → Apify → Bright Data → Playwright |
| Snapchat | Snapchat API → Apify → Playwright |

## Confidence scores

| Source | Score |
|--------|------:|
| Official API (Meta, TikTok, YouTube) | 100 |
| Manual import | 100 |
| Apify | 90 |
| Bright Data | 85 |
| YouTube public metadata | 75 |
| Playwright | 70 |

Stored on `campaign_publications`:

- `metrics_provider`
- `metrics_confidence`

## Worker queue

**Queue name:** `publication-metrics`  
**Scheduler:** `publication-metrics-scheduler` (hourly scan)

Registered in `services/discovery-worker` alongside discovery queues.

**Retry policy:** 3 attempts, exponential backoff starting at 5s (BullMQ job options).

### Run worker

```bash
cd services/discovery-worker
npm run dev
```

Requires:

- `REDIS_URL`
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Provider API keys (see below)

## Status model

`metrics_refresh_status` values:

| Status | Meaning |
|--------|---------|
| `queued` | Waiting for worker |
| `pending` | Never collected |
| `collecting` | In progress |
| `completed` | Full metrics |
| `partial` | Some metrics (report still possible) |
| `manual_required` | No automated data |
| `failed` | Providers exhausted |

## Scheduled refresh (published content)

Computed in `schedule-next-refresh.ts`:

1. **First refresh:** 1 hour after publication date (or created date)
2. **Days 1–7:** daily refresh
3. **After day 7:** weekly refresh

Stored in `metrics_next_refresh_at`. Hourly scheduler enqueues due rows.

## Sync logs

Table: `publication_metric_sync_logs`

Each provider attempt stores:

- `provider`, `status`, `attempt_order`
- `request_payload`, `response_summary`
- `duration_ms`, `error`, `error_code`
- `metrics_snapshot`, `triggered_by`

## UI

**Campaign Performance → Sync health** KPI strip:

- Synced / Partial / Failed / Manual required / Queued / Collecting

Actions:

- Row ⋯ → **Refresh metrics**
- Header → **Refresh all metrics**
- Bulk selection → **Refresh metrics**
- **Import metrics CSV** (manual fallback)

## Environment variables

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | BullMQ queue (required for async collection) |
| `META_GRAPH_ACCESS_TOKEN` | Instagram Graph |
| `APIFY_TOKEN` | Apify scrapers |
| `APIFY_INSTAGRAM_ACTOR_ID` | Instagram post scraper (default: `apify/instagram-scraper`) |
| `APIFY_INSTAGRAM_ACTOR_ID` | Instagram post scraper (default: `apify/instagram-scraper`) |
| `APIFY_TIKTOK_ACTOR_ID` | TikTok scraper (default: `clockworks/tiktok-scraper`) |
| `APIFY_FACEBOOK_ACTOR_ID` | Facebook post/reel scraper for direct permalinks (default: `clappi/facebook-posts-reels-scraper`, input `postUrls`) |
| `APIFY_FACEBOOK_PROFILE_ACTOR_ID` | Facebook page/profile scraper (default: `apify/facebook-pages-scraper`, input `startUrls`) |
| `APIFY_YOUTUBE_ACTOR_ID` | YouTube scraper fallback (default: `streamers/youtube-scraper`) |
| `APIFY_SNAPCHAT_ACTOR_ID` | Snapchat profile scraper (default: `automation-lab/snapchat-scraper`) |
| `FACEBOOK_GRAPH_ACCESS_TOKEN` | Facebook Graph (falls back to `META_GRAPH_ACCESS_TOKEN`) |
| `SNAPCHAT_API_KEY` | Snapchat Marketing API (partnership required) |
| `BRIGHTDATA_API_KEY` | Bright Data |
| `BRIGHTDATA_INSTAGRAM_DATASET_ID` | Instagram dataset |
| `YOUTUBE_API_KEY` | YouTube Data API |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | TikTok official API |
| `CRON_SECRET` | Vercel cron fallback route |

Without `REDIS_URL`, the app falls back to **inline collection** in server actions (no Playwright).

## Database migrations

Apply in order:

1. `20260624120000_campaign_metrics_collection.sql`
2. `20260624130000_production_metrics_collection.sql`

```bash
npx supabase db push --include-all
```

## Success criteria

When a user adds an Instagram/TikTok/YouTube URL:

1. Job is queued automatically (`auto_create`)
2. Worker tries all configured providers in order
3. Best available metrics populate: views, reach, impressions, likes, comments, shares, saves, engagements, engagement_rate
4. If incomplete → `partial`; if none → `manual_required` with CSV import path

## Tests

```bash
npm run test:metrics-collector
```

## Operational notes

- Playwright runs **only in discovery-worker** (browser pool).
- TikTok/Snapchat official APIs require platform partnerships; pipeline falls through to Apify/Playwright.
- Monitor `publication_metric_sync_logs` for provider failures and latency.
