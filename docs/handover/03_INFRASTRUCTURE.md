# 03 — Infrastructure

## Components

| Component | Provider | Notes |
|-----------|----------|-------|
| Web app | Vercel Production | Stateless Next.js |
| Database / Auth / Storage | Supabase | Dedicated prod project required |
| Redis | Upstash / managed Redis | BullMQ + heartbeat |
| Worker | VM/container | `discovery-worker` process |
| DNS / SSL | Domain registrar + Vercel | HTTPS only |
| Cron | Vercel Cron → `/api/cron/*` | `CRON_SECRET` |

## Environment matrix

See `docs/infrastructure/ENVIRONMENT_MATRIX.md`.

**Rule:** Never point production Vercel at the thinkway-dev Supabase project (`hsxrewjcbvmbkqdlzjhs`).

## Verification

1. `GET /api/health` → liveness  
2. `GET /api/ready` (with secret) → Redis, DB, storage, worker  
3. `GET /api/version` → build SHA + supabase alignment  
4. Operations Center → `/operations`

