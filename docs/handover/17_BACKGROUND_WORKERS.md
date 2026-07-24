# 17 — Background Workers

## Process

`services/discovery-worker` — BullMQ consumers for discovery, enrichment, imports, publication metrics/screenshots, performance reports.

## Ops

- Start: `npm run discovery:worker` (see scripts)  
- Heartbeat: Redis `thinkway:worker:discovery:heartbeat`  
- Queues: `lib/observability/discovery-queues.ts`  
- Security: service role; entity-scoped jobs; cron via `CRON_SECRET`

Docs: `docs/infrastructure/WORKER_OPERATIONS.md`, `docs/security/BACKGROUND_WORKER_SECURITY_REVIEW.md`.

