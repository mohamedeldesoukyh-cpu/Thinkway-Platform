# Publication Metrics Pipeline Verification

End-to-end verification for the Thinkway publication metrics collection pipeline:

**Next.js (queue producer) → Redis/BullMQ → discovery-worker → Supabase (`campaign_publications` + `publication_metric_sync_logs`)**

## Quick start

```bash
# Terminal 1 — Next.js (optional for this check)
npm run dev

# Terminal 2 — discovery-worker (required)
npm run discovery:worker:dev

# Terminal 3 — run verification
npm run verify:publication-metrics-pipeline
```

On Windows, both the verification script and `discovery:worker:dev` use `NODE_OPTIONS=--use-system-ca` so Supabase TLS works with the system certificate store.

## What the script checks

| Step | Check |
|------|--------|
| 1 | `REDIS_URL` present in root `.env` / `.env.local` and `services/discovery-worker/.env` |
| 1b | Next.js runtime loads `REDIS_URL` via dotenv |
| 1c | Next.js and worker `REDIS_URL` resolve to the **same Redis instance** (probe key) |
| 2 | Redis ping + `isMetricsQueueAvailable()` |
| 3 | Select a real `campaign_publications` row with `content_url` |
| 4 | Enqueue via `queuePublicationForMetrics` + `enqueuePublicationMetricsJob` |
| 5 | Poll BullMQ job until `completed` or `failed` (120s timeout) |
| 6 | Compare `campaign_publications` before/after (status, sync timestamps, metrics) |
| 7 | Confirm new `publication_metric_sync_logs` rows for the run |
| 8 | Print structured PASS/FAIL summary |

## Files

| File | Purpose |
|------|---------|
| `scripts/verify-publication-metrics-pipeline.ts` | Verification logic |
| `scripts/run-verify-publication-metrics-pipeline.mjs` | Windows TLS wrapper (`npx tsx` + `--use-system-ca`) |
| `scripts/run-discovery-worker-dev.mjs` | Worker dev wrapper with `--use-system-ca` |
| `lib/performance/metrics-collector/queue.ts` | Queue producer (`enqueuePublicationMetricsJob`) |
| `services/discovery-worker/src/workers/publication-metrics.worker.ts` | Queue consumer |

## Prerequisites

1. **Redis** running and reachable (e.g. Docker `thinkway-redis` on port 6379).
2. **Aligned `REDIS_URL`** in both environments — see [Known gaps](#known-gaps).
3. **Supabase** service role key in root `.env` (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`).
4. **Worker env** at `services/discovery-worker/.env` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`.
5. **Migrations applied**: `20260624120000_campaign_metrics_collection.sql`, `20260624130000_production_metrics_collection.sql`.
6. At least one `campaign_publications` row with a non-empty `content_url`.
7. **discovery-worker running** before or shortly after enqueue (`npm run discovery:worker:dev`).

## Expected output (passing infrastructure run)

```
=== Publication Metrics Pipeline — End-to-End Verification ===

1) REDIS_URL configuration
PASS  Next.js .env REDIS_URL — redis://localhost:6379
PASS  Next.js runtime REDIS_URL (dotenv loaded) — redis://localhost:6379
PASS  discovery-worker .env REDIS_URL — redis://localhost:6379
PASS  isMetricsQueueAvailable() — queue producer can connect
PASS  REDIS_URL endpoint alignment — localhost:6379
PASS  REDIS_URL instance probe — Next.js and worker URLs reference the same Redis

2) Redis and publication-metrics queue
PASS  Redis ping — redis://localhost:6379

3) Test publication selection
PASS  Test publication found — id=<uuid>
      platform: instagram
      content_url: https://www.instagram.com/reel/...

4) Enqueue metrics collection job
PASS  Queue accepted job — jobId=<n>, queue=publication-metrics

5) discovery-worker job processing
PASS  Worker processed job — returnvalue={"publicationId":"...","status":"failed","source":null}

6) campaign_publications metrics write-back
PASS  Publication row updated — status=failed

7) publication_metric_sync_logs
PASS  Sync log entry created — id=<uuid>, provider=playwright, status=failed
      message: Captcha detected: captcha
      (4 new log rows for this run)

8) Verification summary
      checks: 12 passed, 0 failed (12 total)
      jobId: 5
      syncLogId: 076f1bea-82d7-4d9b-9542-5d30c30e3b8a
      final metrics: views=null, likes=null, status=failed

=== Done ===
```

### Interpreting results

- **Infrastructure PASS**: job enqueued, worker consumed it, `campaign_publications.metrics_refresh_status` updated, sync logs inserted.
- **Provider outcome** may still be `failed` / `manual_required` if external APIs (Apify, Instagram captcha, missing `APIFY_TOKEN`, etc.) do not return metrics. That is expected for some URLs and does not indicate a broken queue pipeline.
- **Successful metric values** (`views`, `likes`, …) require a provider to succeed (e.g. configured `APIFY_TOKEN` and a scrapable URL). Use `npm run test:apify-instagram -- <url>` to test Apify separately.

## Sample run (2026-06-23)

| Field | Value |
|-------|-------|
| Publication ID | `2729bb00-f046-4db0-8229-b7ae5f3b6402` |
| Campaign header | `20374f67-1c2f-4df0-b999-124a8d506c3c` |
| Platform | `instagram` |
| BullMQ job ID | `5` |
| Sync log ID | `076f1bea-82d7-4d9b-9542-5d30c30e3b8a` |
| Worker return | `{ status: "failed", source: null }` (Playwright captcha on reel URL) |
| DB status after | `metrics_refresh_status = failed` |
| Sync log rows | 4 (provider chain attempts) |

Worker log:

```
[publication-metrics] completed 5 {
  publicationId: '2729bb00-f046-4db0-8229-b7ae5f3b6402',
  status: 'failed',
  source: null
}
```

## Known gaps and fixes applied during verification

### 1. `localhost` vs `127.0.0.1` on Windows (critical)

On this Windows + Docker setup, `redis://localhost:6379` and `redis://127.0.0.1:6379` pointed at **different Redis instances**. Jobs enqueued by Next.js (localhost) were invisible to the worker (127.0.0.1).

**Fix:** Use the same host in both `.env` files, e.g. `REDIS_URL=redis://localhost:6379`. The verification script includes an instance probe to catch this.

### 2. Windows TLS for discovery-worker

Without `NODE_OPTIONS=--use-system-ca`, worker jobs failed immediately with `TypeError: fetch failed` when calling Supabase.

**Fix:** `npm run discovery:worker:dev` now runs via `scripts/run-discovery-worker-dev.mjs` (same pattern as `npm run dev`).

### 3. Shared Redis connection across BullMQ workers

`getRedisConnection()` previously returned a singleton `IORedis` client shared by all workers. BullMQ workers need dedicated blocking connections.

**Fix:** `services/discovery-worker/src/queues/connection.ts` now creates a new connection per call.

### 4. Provider / metric value collection

Pipeline infrastructure was verified; **numeric metrics were not populated** in the sample run because Instagram scraping hit a captcha (Playwright provider). Configure `APIFY_TOKEN` and/or platform APIs for reliable metric values on production URLs.

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Job stays `waiting` 120s | Worker not running or wrong Redis | Start `npm run discovery:worker:dev`; align `REDIS_URL` |
| `fetch failed` on worker | Windows TLS | Use `npm run discovery:worker:dev` (not raw `npm run dev` in worker folder) |
| `REDIS_URL instance probe` FAIL | localhost ≠ 127.0.0.1 | Unify host in both env files |
| No publication found | Empty table | Add a publication with `content_url` |
| Job `completed` but `status: failed` | Provider/captcha | Expected for some URLs; check sync logs and `APIFY_TOKEN` |
| No sync logs | Job never reached collector | Check worker logs for import/Supabase errors |

## Manual Redis inspection

```bash
docker exec thinkway-redis redis-cli LLEN "bull:publication-metrics:wait"
docker exec thinkway-redis redis-cli HGETALL "bull:publication-metrics:<jobId>"
```

## Related commands

```bash
npm run discovery:verify          # Discovery stack health (includes Redis)
npm run verify:campaign-performance  # campaign_publications schema
npm run test:apify-instagram -- <instagram-reel-url>
```
