# Avatar & Publication Preview Performance (Phase 2)

## Problem

`/api/creators/avatar` and `/api/creators/publication-preview` previously ran the **full** external resolution path on every request:

1. CDN fetch with up to **20s** abort timeout
2. Sequential HTML scrape / Instagram media redirect / oEmbed / OpenGraph on miss

Creator grids fan out dozens of these calls in parallel, blocking image paint and inflating API latency, external egress, and failed-image rates when CDNs expire.

## Fix

Split resolvers into **request path** vs **full / background** path.

| Path | Avatar | Publication preview |
|------|--------|---------------------|
| HTTP request | `resolveCreatorAvatarForHttpRequest` | `resolvePublicationPreviewForHttpRequest` |
| Export / stabilize / `after()` refresh | `fetchCreatorAvatarImage` | `fetchPublicationPreviewImage` |

### Request path (never blocks on scrape)

1. Process-local LRU cache (hit → bytes immediately)
2. Thinkway storage download (avatars only, short timeout)
3. Fresh CDN fetch with **1.5s** timeout (allowed hosts only)
4. On miss → **404** immediately (client shows existing placeholder)
5. Schedule `after(() => refresh…)` for async warm of cache

### Shared infrastructure

`lib/creators/media-proxy-cache.ts`

- Positive TTL 1h / negative TTL 45s
- In-flight dedupe (`withMediaProxyInflight`)
- Counters: hits, misses, CDN/storage hits, placeholders, refresh scheduled/success/fail, external requests

### Response headers

- `X-Avatar-Cache` / `X-Preview-Cache`: `cache` | `storage` | `cdn` | `miss`
- Success: `Cache-Control: private, max-age=3600`
- Miss: `Cache-Control: private, max-age=30`

## Preserved behavior

- Export pipelines (quotations, shortlists, media plan, campaign proposal) still call **full** fetch helpers — quality and recovery via oEmbed/OG unchanged.
- Browser display URLs still point at the same API routes; `CreatorAvatarImage` / publication thumbs still fall back to placeholders on error/404.
- Discovery search, Campaign Studio, and AI workflows are untouched.

## Measurement

```bash
npm run measure:media-proxy
```

Optional live CDN probe:

```bash
MEDIA_PROXY_LIVE_CDN=1 MEDIA_PROXY_CDN_URL="https://…" npm run measure:media-proxy
```

Reports for a simulated grid:

| Metric | Field |
|--------|--------|
| API latency | `latency.p50` / `p95` / `p99` |
| Cache hit rate | `cacheHitRate` |
| External request count | `externalRequests` |
| Grid rendering time | `gridRenderMs` |
| Failed image rate | `failedImageRate` (request-path 404 / placeholder) |

### Baseline (before Phase 2)

Request path = full scrape/oEmbed chain, `AbortSignal.timeout(20_000)`.

Expect under grid fan-out: high p95/p99 (seconds), externalRequests ≈ concurrent misses, grid wall time dominated by slowest external.

Paste `npm run measure:media-proxy` output here before deploy if capturing a live before snapshot against production CDN URLs.

### After Phase 2 (local harness, 2026-07-21)

`npm run measure:media-proxy` — half-cached 48-cell grid (no live CDN):

| Suite | gridRenderMs | p50 / p95 / p99 (ms) | cacheHitRate | externalRequests | failedImageRate |
|-------|-------------:|---------------------:|-------------:|-----------------:|----------------:|
| Avatar | **1** | 0.25 / 0.36 / 0.53 | 0.5 | **0** | 0.5 (intentional placeholders) |
| Publication preview | **0** | 0.14 / 0.22 / 0.32 | 0.5 | **0** | 0.5 (intentional placeholders) |

Cached half returns bytes immediately; uncached half is profile/post-only → instant 404 + `needsRefresh` (no scrape on request path). Re-run after deploy for production CDN samples.

## Tests

```bash
npm run test:media-proxy
```
