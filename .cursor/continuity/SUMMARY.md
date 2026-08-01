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
- `docs/architecture/CAMPAIGN_WORKSPACE_UI_FREEZE.md` — **Campaign Workspace UI Design Freeze** (2026-08-01)  
- `docs/architecture/CAMPAIGN_WORKSPACE_UI_GUIDELINES.md` — Aurora extension rules (no redesign; functional only)  
- `docs/architecture/UNIFIED_MEDIA_PLAN_PLAN.md` — Media Plan SSOT (baseline + draft)  
- `docs/architecture/MEDIA_PLAN_VERSIONING.md` — business version vs audit; approval boundary  
- Publishing Calendar: Saturday–Friday calendar weeks (`media-plan-week-start.ts`); range from campaign start/end  
- `lib/media-plan` — Media Plan Engine (Studio / Campaign / Portal / Performance)  
- `docs/DISCOVERY_*` · `docs/PERFORMANCE_*` — discovery & perf contracts  
- Ops Center `/operations` — deployment/health SSOT  

## Campaign Workspace UI (frozen)

- Surface: `/campaigns/[id]` — Aurora language is the design foundation going forward.
- After 2026-08-01 freeze: **no visual redesigns** unless critical usability or approved release reopen.
- New capabilities integrate into existing frame/ops patterns; do not invent a parallel style.

## Platform navigation standard

- **Enterprise Tabs** (`components/workspace/enterprise-tabs.tsx` + `app/styles/enterprise-tabs.css`) — only approved workspace tab rail.
- Future modules must reuse it; no page-specific tab implementations or sizing overrides.

## Ops & workers

- Redis + BullMQ for discovery/performance queues.
- Heartbeat key: `thinkway:worker:discovery:heartbeat`.
- Local worker: `npm run discovery:worker:dev`. Production worker: separate host (e.g. Railway), `npm run discovery:worker`.
- Hosted Dev and Prod must use **separate** `REDIS_URL` values.

## Roles (high level)

Admin / Director / Manager / Account Manager / Finance / Data Entry — enforce via RLS + app auth matrix (reference §6).
