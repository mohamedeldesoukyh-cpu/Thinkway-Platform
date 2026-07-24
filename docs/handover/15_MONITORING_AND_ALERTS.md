# 15 — Monitoring & Alerts

## Primary console

`/operations` — Health Engine, alerts, queues, adapters, logs.

## Probes

- `/api/health` — public liveness  
- `/api/ready` — detailed readiness (secret/admin)  
- `/api/admin/queues` — queue JSON  
- Worker heartbeat Redis key  

## Alert examples

Redis/Supabase down, worker stale, queue stuck, AI unavailable, high latency, low health score.

## Gaps / residual

- Sentry install recommended (`SENTRY_DSN`)  
- External uptime (Better Uptime / Checkly) on `/api/health`  
- Persist ops metrics beyond process memory  

