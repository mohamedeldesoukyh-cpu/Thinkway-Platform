# Arab Bank X La Liga Event — Metrics Failure Investigation

**Date:** 2026-06-23  
**Campaign:** Arab Bank X La Liga Event (`TW-2026-0001`, id `20374f67-1c2f-4df0-b999-124a8d506c3c`)

## Summary

Publications show **Metrics = Failed** because the **discovery-worker** processes metrics jobs without `APIFY_TOKEN` (or other provider credentials). Apify is skipped, Meta Graph and Bright Data are skipped, and the Playwright fallback hits an **Instagram captcha**. The URL is valid and Apify returns metrics when the token is present (verified locally). **No mapper fix is required.**

> **Note:** The database currently has **one** publication in this campaign with `metrics_refresh_status = 'failed'`, not two. Sync health “Failed: 1” matches that row.

---

## Failed publication

| Field | Value |
|-------|-------|
| `publication_id` | `92a881b8-a272-4e16-a7e7-6475bb42c57e` |
| `content_url` | `https://www.instagram.com/p/DXywMywIwgb/` |
| `platform` | `instagram` |
| `metrics_refresh_status` | `failed` |
| `metrics_refresh_attempted_at` | `2026-06-23T02:45:07Z` |

---

## Latest sync log rows (most recent run: `bulk_refresh`)

### 1. apify — skipped

| Field | Value |
|-------|-------|
| `provider` | `apify` |
| `status` | `skipped` |
| `error` | *(null)* |
| `response_summary` | `{ "success": false, "metricsSummary": "none" }` |
| `message` | `APIFY_TOKEN not configured.` |

### 2. meta_graph_api — skipped

| Field | Value |
|-------|-------|
| `provider` | `meta_graph_api` |
| `status` | `skipped` |
| `message` | `META_GRAPH_ACCESS_TOKEN not configured.` |

### 3. brightdata — skipped

| Field | Value |
|-------|-------|
| `provider` | `brightdata` |
| `status` | `skipped` |
| `message` | `Bright Data credentials not configured.` |

### 4. playwright — failed (terminal)

| Field | Value |
|-------|-------|
| `provider` | `playwright` |
| `status` | `failed` |
| `error` | `Captcha detected: captcha` |
| `error_code` | `provider_exception` |
| `response_summary` | `{ "success": false, "metricsSummary": "none" }` |
| `duration_ms` | `8849` |

An earlier run (`triggered_by: auto_create`) shows the same provider chain and outcomes.

---

## Failure classification

| Hypothesis | Result |
|------------|--------|
| URL invalid | **No** — URL is a valid Instagram `/p/` post; Apify fetches it successfully |
| Instagram captcha (Playwright) | **Yes** — final provider failed with `Captcha detected: captcha` |
| Apify `not_found` | **No** — Apify was never called (token missing in worker) |
| Apify actor failed | **No** — actor succeeds when `APIFY_TOKEN` is set |
| URL parsing failed | **No** — `detect-platform` extracts shortcode `DXywMywIwgb` from `/p/` path |
| Private account/post | **No** — Apify returned public metrics |
| Mapping failed | **No** — mapper maps `videoViewCount`, `likesCount`, `commentsCount` correctly |

**Root cause:** Missing provider credentials in **discovery-worker** environment (`services/discovery-worker/.env`), not in application code or mapper.

### Environment comparison

| Variable | Root `.env` | `services/discovery-worker/.env` |
|----------|-------------|----------------------------------|
| `APIFY_TOKEN` | ✅ present | ❌ absent |
| `META_GRAPH_ACCESS_TOKEN` | ✅ present | ❌ absent |
| `BRIGHTDATA_API_KEY` | ✅ present | ❌ absent |

The worker loads env via `dotenv/config` from its own directory (`services/discovery-worker/src/config.ts`), so root `.env` values are not visible to queued metrics jobs.

---

## Apify smoke test (local, with root `.env`)

```text
npm run test:apify-instagram -- "https://www.instagram.com/p/DXywMywIwgb/"
```

| Metric | Value |
|--------|-------|
| Duration | ~6354ms |
| Provider | `apify` |
| Available | `true` |
| Views | 9000 |
| Likes | 363 |
| Comments | 12 |
| Engagements | 375 |
| Engagement rate | 4.167% |
| Complete | yes |

**Mapper fix needed?** **No.** Metrics were returned and mapped without changes to `apify-mapper.ts`.

---

## Recommended fix (configuration, not code)

1. Add metrics provider credentials to **`services/discovery-worker/.env`** (or unify env loading so the worker inherits root `.env`):
   - `APIFY_TOKEN`
   - `META_GRAPH_ACCESS_TOKEN` (optional fallback)
   - `BRIGHTDATA_API_KEY` + `BRIGHTDATA_INSTAGRAM_DATASET_ID` (optional fallback)
2. Restart the discovery worker.
3. Re-queue metrics for the publication (Performance tab → refresh, or set `metrics_refresh_status = 'queued'`).

After step 1–3, Apify should succeed on the first provider attempt and persist metrics without reaching Playwright.

---

## What was not changed

Per investigation constraints: no changes to queue/worker/redis infrastructure, UI, or `apify-mapper.ts`.
