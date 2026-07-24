# Operations Center

Centralized internal Operations Center for Thinkway platform health and diagnostics.

## Route

- **UI:** `/operations` (App Router, internal dashboard)
- **API:** `GET /api/operations-center/snapshot` (admin-classified, no public access)

Business tools remain at:

- `/operations/move`
- `/operations/reassignment`

## Access control

Allowed roles only:

- `super_admin`
- `admin`
- `operations`
- `devops`

Portal / client workspace users are denied (P4 workspace isolation + `requireOperationsCenterAccess`).

## What it shows

1. Overall health score (0–100) and status  
2. Infrastructure adapters (Next.js, Vercel, Supabase, Redis, BullMQ, Storage, Realtime)  
3. BullMQ queue table (waiting/active/completed/failed/retries/DLQ/ages)  
4. AI providers (OpenAI, Anthropic, Gemini)  
5. Integrations (Apify, Resend, SMTP, Google OAuth, Meta, TikTok, YouTube)  
6. Auth, Discovery, Finance, Storage, Security metric cards  
7. Dependency graph  
8. Unified ops log buffer  
9. Alert list  

## Module layout

```
features/operations-center/
  adapters/          # HealthProvider registry + providers
  health/            # Health engine + score
  alerts/            # Alert evaluation
  dependency-graph/  # Live dependency map
  logs/              # Unified log buffer
  queues/            # BullMQ monitor
  domains/           # Domain metric collectors
  metrics/           # In-process AI + security counters
  components/        # Dashboard UI
  services/          # Snapshot builder
```

## Related docs

- `HEALTH_ENGINE.md`
- `MONITORING_ADAPTERS.md`
- `ALERT_ENGINE.md`
- `DEPENDENCY_GRAPH.md`
