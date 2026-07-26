# Summary — Thinkway Platform Knowledge Base

Enterprise influencer marketing **operations** platform (not CRUD). Product: Thinkway · Prefix: TW · Primary: `#1D9E75`.

## Stack

Next.js App Router · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel · BullMQ/Redis · discovery-worker (separate process)

## Domain hierarchy (preserve)

```
Group → Legal Entity (clients) → Brand → Campaign Header → Campaign Line
```

- Brand-first campaign create; commercial fields live on **brands**.
- Header codes `TW-YYYY-NNNN`; lines `{header}-A/-B/-C` (yearly reset).
- Finance (revenue, cost, GP, PO, billing) at **line** level; aggregate upward.
- UI: Legal entity · Brand · Vendor/Influencer · Campaign · Campaign line · Vendor assignment.

## Environments

| Surface | URL | Supabase | Git / Deploy |
|---|---|---|---|
| Local | localhost | Dev (default) | `npm run dev` (+ optional `discovery:worker:dev`) |
| Development | `dev.thinkwaymedia.com` | `hsxrewjcbvmbkqdlzjhs` | Branch `develop` (auto) |
| Production | `app.thinkwaymedia.com` | `ienowhwfyxoqtzbgltno` | Approval only |

Environment switch navigates between **hosts** — never switches DB inside one process.

## Canonical docs

- `docs/THINKWAY_SYSTEM_REFERENCE.md` — product SSOT  
- `docs/ARCHITECTURE_ALIGNMENT.md` — codebase vs spec  
- `docs/RELEASE_WORKFLOW.md` — dual deploy + approval gate  
- `docs/DISCOVERY_*` · `docs/PERFORMANCE_*` — discovery & perf contracts  
- Ops Center `/operations` — deployment/health SSOT  

## Ops & workers

- Redis + BullMQ for discovery/performance queues.
- Heartbeat key: `thinkway:worker:discovery:heartbeat`.
- Local worker: `npm run discovery:worker:dev`. Production worker: separate host (e.g. Railway), `npm run discovery:worker`.
- Hosted Dev and Prod must use **separate** `REDIS_URL` values.

## Roles (high level)

Admin / Director / Manager / Account Manager / Finance / Data Entry — enforce via RLS + app auth matrix (reference §6).
