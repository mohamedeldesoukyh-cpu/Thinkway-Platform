# Shimaa Saber — Partial Metrics Root Cause (2026-06-23)

## Summary

Two Instagram carousel posts for creator **Shimaa Saber** (`INF-000001`) were stuck in `metrics_refresh_status: partial` despite Apify returning usable comment counts. The TikTok publication for the same line collected correctly as `completed`.

## Affected publications

| Publication ID | URL | Platform | Before status |
|---|---|---|---|
| `71764674-6045-4376-84b6-2759a6367d57` | https://www.instagram.com/p/DXw-8FejUu3/ | instagram | partial |
| `253bc521-fa0b-4714-b547-0c1d26191e43` | https://www.instagram.com/p/DX2LdWPDdae/ | instagram | partial |

Campaign line: `b6a8c19d-ef5b-41d2-b2ac-4b09debda13c` · Header: `20374f67-1c2f-4df0-b999-124a8d506c3c`

## Investigation findings

### Stored metrics (before fix)

**Post 1** (`DXw-8FejUu3`):

- `views`: null (expected — static/carousel Instagram posts have no view count)
- `likes`: **-1** (Apify sentinel for hidden like counts)
- `comments`: 108
- `engagements`: 107 (computed from -1 + 108)
- `metrics_provider`: apify · `metrics_confidence`: 90

**Post 2** (`DX2LdWPDdae`):

- `views`: null
- `likes`: **-1**
- `comments`: 32
- `engagements`: 31
- `metrics_refresh_status`: partial

### Sync logs

Apify runs succeeded (`status: success`) with snapshots like:

```json
{ "likes": -1, "comments": 108, "views": null }
```

### Raw Apify payload (smoke test)

```
npm run test:apify-platform -- "https://www.instagram.com/p/DXw-8FejUu3/?img_index=1"
```

Result:

- URL valid, publication exists
- Account is **not** private
- Post type supported (Instagram carousel/post)
- Apify returns `likes: -1`, `comments: 108`, no views

Instagram hides like counts on some posts; Apify encodes unavailable likes as **-1**.

## Root cause

1. **`apify-mapper`** persisted `-1` as a numeric like count instead of NULL.
2. **`isCompleteMetrics`** required both a reach signal (views/reach/impressions) **and** an engagement signal (likes/comments/shares/saves > 0). Carousel posts have no views; `-1` likes are not > 0, so only comments counted — but the old rule still required reach **and** engagement, yielding `partial`.
3. **`outcomeFromAttempts`** marked any incomplete merge as `partial` even when comments (or likes/views) were available.

## Fix

Updated collector logic in:

- `lib/performance/metrics-collector/merge-metrics.ts` — `sanitizeMetricValue()` drops negative values; `metricsRefreshStatusFor()` marks `completed` when any of views/likes/comments is present
- `lib/performance/metrics-collector/providers/apify-mapper.ts` — uses sanitizer for all mapped fields
- `lib/performance/metrics-collector/persist.ts` — sanitizes before write; new status rules

**New rules:**

- Persist all available metrics when views, likes, or comments are present
- Never store negative values (-1 → NULL)
- `partial` only when views, likes, **and** comments are all NULL

## After re-sync (verified)

| Field | Post 1 (`DXw-8FejUu3`) | Post 2 (`DX2LdWPDdae`) |
|---|---|---|
| views | null | null |
| likes | null (was -1) | null (was -1) |
| comments | 108 | 32 |
| engagements | 108 (was 107) | 32 (was 31) |
| metrics_refresh_status | **completed** | **completed** |
