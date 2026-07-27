# Queue Architecture — Redis / BullMQ

## Topology

```
Next.js (producers) ──REDIS_URL──► Redis ◄──REDIS_URL── discovery-worker (consumers)
```

**Critical rule:** Producers must use `createBullMqQueueConnection(url)` (`lib/redis/bullmq-connection.ts`).  
Passing `{ connection: { url } }` is **ignored by ioredis** and falls back to `localhost:6379`.

## Queue inventory (primary)

| Queue | Worker | Retries (typical) | DLQ |
|---|---|---|---|
| `discovery-run` | discovery.worker | Retention-focused (align retries recommended) | No |
| `discovery-enrich` | enrichment.worker | Retention-focused | No |
| `enterprise-acquisition` | enterprise-acquisition.worker | Retention-focused | No |
| `publication-metrics` | publication-metrics.worker | 3 / exp 5s | No |
| `publication-screenshot` | screenshot worker | 3 / exp 5s | No |
| `creator-import` / chunk | creator-import.worker | 3 / exp 5s; stalled lock policy | No |
| `creator-enrichment` | creator-enrichment.worker | 3 / exp 5s | **Yes** (`creator-enrichment-dlq`) |

Entry: `services/discovery-worker/src/index.ts`  
Names: `services/discovery-worker/src/queues/names.ts`, `lib/observability/discovery-queues.ts`

## Resilience

| Concern | Status |
|---|---|
| Producer↔consumer Redis match | Fixed for discovery, enrichment, campaign-performance, **metrics, import, acquisition cancel** (stabilisation sprint) |
| Stuck import/enrichment recovery | Worker boot helpers |
| DLQ coverage | Only enrichment today — expand later |
| Named queues without consumers | Review `creator-import-enrich`, `performance-report` in health lists |

## Ops

- Heartbeat + Ops Center queue stats
- Isolation validation: `docs/security/REDIS_ISOLATION_VALIDATION_2026-07-26.md`
- Worker ops: `docs/infrastructure/WORKER_OPERATIONS.md`, `docs/handover/17_BACKGROUND_WORKERS.md`

## Regression test

```bash
npm run test:bullmq-connection
```
