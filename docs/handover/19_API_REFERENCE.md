# 19 — API Reference (Operational)

Classification source: `lib/security/workspace-classification-registry.ts` / `docs/security/API_CLASSIFICATION_MATRIX.md`.

## Public

`GET /api/health`, `/api/version`, `/api/build-info`, `/api/ready` (minimal)

## Service only

`GET /api/cron/publication-metrics`, `/api/cron/campaign-performance-monitor` — Bearer `CRON_SECRET`

## Admin / ops

`GET /api/admin/queues`, campaign-performance health/dashboard, `GET /api/operations-center/snapshot`

## Internal (staff session + permissions)

`/api/ai/*`, `/api/discovery/*`, `/api/operations/*`, `/api/reports/*`, export/document routes, etc.

Unclassified routes → **403**.

