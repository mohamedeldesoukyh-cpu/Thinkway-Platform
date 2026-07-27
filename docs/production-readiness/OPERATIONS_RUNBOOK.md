# Operations Runbook (Index)

Canonical day-2 ops live in handover + infrastructure docs. This index points to the right entry for Production incidents.

## Health

| Check | Where |
|---|---|
| Liveness | `GET /api/health` |
| Build / env fingerprint | `GET /api/build-info` |
| Ready (detail gated) | `GET /api/ready` + `READY_API_SECRET` or admin |
| Ops Center | Internal Operations workspace |
| Worker heartbeat | `lib/observability/worker-heartbeat.ts` |

## Queues stuck / jobs not consuming

1. Confirm `REDIS_URL` on **app** and **worker** match the same environment.
2. Confirm producers use `createBullMqQueueConnection` (not `{ url }` localhost bug).
3. Check worker process + heartbeat.
4. Triage failed jobs: `scripts/triage-failed-queue-jobs.ts` (after connection fix).
5. Import/enrichment stuck recovery runs on worker boot.

See [QUEUE_ARCHITECTURE.md](./QUEUE_ARCHITECTURE.md).

## CRM writers accidentally enabled

1. Immediately `vercel env rm CREATOR_CRM_WRITERS_ENABLED …` (or set false) on the affected env.
2. Redeploy.
3. Audit `creator_crm_profiles` / `creator_crm_activation_events` on that Supabase project.
4. Do **not** enable on Production as remediation.

## Discovery browse regression

If browse falls back to legacy full-catalog path, treat as Production incident (perf). Prefer RPC `browse_influencer_ids_by_recency`.

## Deep runbooks

- `docs/handover/21_RUNBOOK.md`
- `docs/handover/25_POST_GO_LIVE_OPERATIONS.md`
- `docs/operations/OPERATIONS_CENTER.md`
- `docs/infrastructure/WORKER_OPERATIONS.md`
- `docs/MONITORING_SETUP.md`
