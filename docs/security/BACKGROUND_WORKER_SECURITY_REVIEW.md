# Background Worker Security Review (P4)

## Surface inventory

| Surface | Class | Auth |
|---------|-------|------|
| BullMQ discovery-worker | `service_only` | Redis + service-role Supabase |
| Creator enrichment queue | `service_only` | Payload `influencerId` required |
| Publication metrics / screenshots | `service_only` | Entity / publication scoped jobs |
| Creator import processing | `service_only` | File / import IDs |
| `/api/cron/publication-metrics` | `service_only` | `CRON_SECRET` |
| `/api/cron/campaign-performance-monitor` | `service_only` | `CRON_SECRET` |

Registry: `WORKER_CLASSIFICATIONS` in `workspace-classification-registry.ts`.

## Isolation rules

1. **No user JWT on workers** — workers use service role; must not trust client-supplied “act as user” without server-side enqueue gates.
2. **Entity scope** — enrichment jobs require `influencerId` (and optional `platformAccountId`). Ambient “all tenants” jobs are forbidden.
3. **Enqueue path** — only internal Server Actions / services after permission checks may enqueue; portal actors denied by P4 `requirePermission`.
4. **Cron** — middleware allows cron only with bearer secret; session alone cannot invoke cron.
5. **Redis** — treat as sensitive; network-restrict to app + worker.

## Wrong-tenant failure mode

| Attack | Outcome |
|--------|---------|
| Portal enqueues enrichment for arbitrary influencer | Blocked — cannot call internal enqueue actions |
| Forged BullMQ job without entity id | Processor expects `influencerId`; structural reject / fail |
| Cron without secret | 401 |
| Cron with user cookie but no secret | 401 / not authorized |

## Residual risk

- Compromise of Redis or worker host ≈ service-role compromise — out of app-layer scope; host hardening required.
- Job payloads are not cryptographically signed — trust the producer (app server) and Redis ACL.
