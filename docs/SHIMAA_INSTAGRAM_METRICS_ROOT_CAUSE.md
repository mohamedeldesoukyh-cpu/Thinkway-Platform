# Shimaa Saber — Instagram Metrics Root Cause

**Date:** 2026-06-23  
**Related:** [SHIMAA_SABER_PARTIAL_METRICS.md](./SHIMAA_SABER_PARTIAL_METRICS.md)

## Summary

Instagram carousel posts for **Shimaa Saber** (`INF-000001`) showed only **comments** in the Campaign Performance grid while views and likes appeared empty. Apify sync succeeded; the issue was payload shape and hidden-like semantics, not a failed scrape.

## Affected publications

| Publication ID | URL | Symptom |
|---|---|---|
| `71764674-6045-4376-84b6-2759a6367d57` | https://www.instagram.com/p/DXw-8FejUu3/ | comments only |
| `253bc521-fa0b-4714-b547-0c1d26191e43` | https://www.instagram.com/p/DX2LdWPDdae/ | comments only |

## Apify sync log findings

Successful Apify runs stored snapshots resembling:

```json
{
  "likes": -1,
  "likesCount": -1,
  "comments": 108,
  "commentsCount": 108,
  "views": null,
  "videoViewCount": null
}
```

Instagram hides like counts on many posts. Apify encodes unavailable likes as **`-1`**. Static/carousel posts often have **no view count** in the public scrape payload.

## Mapper behaviour (before fix)

1. **`likes: -1`** was persisted as a numeric value (or dropped inconsistently).
2. Fallback fields such as `videoPlayCount`, `playCount`, `edge_media_preview_like.count` were not checked for Instagram-specific payloads.
3. **`metrics_refresh_status`** could remain `partial` even when comments were valid.

## Fix applied

| Layer | Change |
|---|---|
| `apify-mapper.ts` / `apify-instagram-fields.ts` | Instagram-specific mapping with fallbacks: `videoPlayCount`, `videoViewCount`, `playCount`, `viewCount`, `likesCount`, `edge_media_preview_like.count`, `likes`, `likeCount`, `edge_media_to_comment.count` |
| `merge-metrics.ts` | `sanitizeMetricValue()` drops negatives (`-1 → null`); `metricsRefreshStatusFor()` → `completed` when any of views/likes/comments present |
| `confidence.ts` | Comments-only collection → `confidence = min(provider, 70)` |
| `persist.ts` | Sanitize before write; use adjusted confidence in `outcomeFromAttempts` |

## Expected state after re-sync

| Field | Post 1 | Post 2 |
|---|---|---|
| views | null | null |
| likes | null | null |
| comments | 108 | 32 |
| engagements | 108 | 32 |
| metrics_refresh_status | **completed** | **completed** |
| metrics_confidence | **70** | **70** |

## Verification commands

```bash
npm run test:metrics-collector
npm run test:apify-platform -- "https://www.instagram.com/p/DXw-8FejUu3/"
```

Re-trigger metrics refresh on affected publications from Campaign Performance → row actions → **Refresh metrics**.
