# Instagram Screenshot Pipeline — Root Cause Analysis

**Date:** June 2026  
**Status:** Fixed

## Symptom

Instagram publications showed `metrics_refresh_status = completed` but `screenshot_url` stayed null. Media drawer and performance reports displayed empty placeholders ("Preview pending"). TikTok previews worked.

## Flow (expected)

```
Publication created
  → publication-metrics BullMQ job
  → metricsCollector (Apify first for Instagram)
  → enqueue publication-screenshot job
  → publication-screenshot worker
  → provider chain: meta_graph → Apify → OpenGraph → Playwright
  → upload to campaign-publication-media bucket
  → campaign_publications.screenshot_url
```

## Root cause

**Primary:** Screenshot capture is **async and best-effort** after metrics. There was **no backfill scheduler** for publications that completed metrics while the screenshot worker was offline, before the worker existed, or when enqueue failed silently (`void enqueue…catch`).

**Why TikTok worked:** TikTok's screenshot chain starts with **`tiktok_oembed`** (fast, no Apify, no storage upload required for basic preview). Instagram depends on the **separate screenshot worker** and Apify `displayUrl` → CDN fetch → Supabase upload.

**Secondary gaps:**

1. Metrics collector did not persist Apify **`displayUrl`** as `thumbnail_url`, so UI had nothing until the async worker finished.
2. `fetchImageBuffer` used minimal headers; some Instagram CDN responses reject bare fetches.
3. When CDN fetch failed, the pipeline discarded a valid Apify `displayUrl` instead of storing it as a fallback.
4. Worker start via `npm run discovery:worker` did not set `NODE_OPTIONS=--use-system-ca` on Windows (TLS issues for some outbound fetches).

## Apify Instagram field names (verified)

Actor: `apify/instagram-scraper`  
Input: `{ directUrls: [url], resultsLimit: 1 }`

Relevant preview fields on dataset items:

| Field | Example use |
|-------|-------------|
| **`displayUrl`** | Primary image/reel poster (used) |
| `videoUrl` | MP4 — not used for preview |
| `images` | Carousel URLs (array) |
| `childPosts` | Nested carousel items |
| `type` | `"Video"`, `"Image"`, etc. |

Metrics fields: `videoViewCount`, `likesCount`, `commentsCount`, etc.

## Fixes applied

1. **`pickApifyPreviewImageUrl`** — shared extractor for metrics + screenshot paths.
2. **Metrics collector** — saves Apify `displayUrl` to `thumbnail_url` immediately; awaits screenshot enqueue with logging.
3. **Screenshot capture** — persists external Apify/OpenGraph URL when CDN upload fetch fails; improved `fetchImageBuffer` headers; uses `buildApifyRunInput` for Apify.
4. **Backfill scheduler** — `publication-screenshot-scheduler` runs every 15 minutes for completed/partial metrics with null `screenshot_url`.
5. **UI/reports** — preview fallback: `screenshot_url → thumbnail_url → influencer_avatar_url`.
6. **Worker startup** — `discovery:worker` uses system CA wrapper on Windows.

## Verification

```bash
npm run test:screenshot-capture
npm run test:apify-instagram -- https://www.instagram.com/p/DXywMywIwgb/
```

Ensure `discovery-worker` is running with `APIFY_TOKEN` and `REDIS_URL`:

```bash
npm run discovery:worker:dev   # or npm run discovery:worker
```

Query pending screenshots:

```sql
SELECT id, platform, content_url, thumbnail_url, screenshot_url, metrics_refresh_status
FROM campaign_publications
WHERE platform ILIKE 'instagram'
  AND screenshot_url IS NULL
  AND metrics_refresh_status IN ('completed', 'partial');
```

## Env / restart

- **Worker restart required** after deploy (new scheduler + capture logic).
- Required env in `services/discovery-worker/.env`: `APIFY_TOKEN`, `REDIS_URL`, `SUPABASE_*`.
- Optional: `META_GRAPH_ACCESS_TOKEN` for Graph thumbnail (shortcode ≠ Graph media id today).
