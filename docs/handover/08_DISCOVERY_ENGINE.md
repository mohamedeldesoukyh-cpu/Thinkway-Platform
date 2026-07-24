# 08 — Discovery Engine

## Surfaces

- UI: `/discovery/*`
- APIs: `/api/discovery/*`
- Import center, shortlists, quotations, campaign match, intelligence library

## Data flow

Browse/search → unified creator pool → DNA/enrichment → shortlist → quotation → campaign promotion.

## Workers

BullMQ queues in `lib/observability/discovery-queues.ts` processed by `services/discovery-worker`.

## Docs

- `docs/DISCOVERY_ARCHITECTURE.md`
- `docs/DISCOVERY_UI_CONTRACT.md`
- `docs/infrastructure/WORKER_OPERATIONS.md`

