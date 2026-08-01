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
- `docs/architecture/THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md` — **frozen platform architecture v1.0**  
- `docs/architecture/BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md` — **canonical BPN navigation baseline**  
- `docs/architecture/CAMPAIGN_WORKSPACE_BASELINE_V1.md` — **protected Campaign Workspace Lifecycle OS** (`e683ad57` on `origin/develop`) — no redesign without Architecture Reopen  
- `docs/architecture/PLATFORM_ARCHITECTURE_COMPLIANCE.md` — mandatory compliance (lifecycle · journeys · BPN reuse · Campaign Workspace invariants · no new nav)  
- `docs/capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md` — **active** 2.2a capability spec (review with Product Review pack; **no code**)  
- `docs/capabilities/PLANNING_BOARD_CAPABILITY_REVIEW.md` — **active** functional capability review pack (**no code**)  
- `docs/architecture/platform-ux/` — Platform UX package (docs 01–12 frozen)  
- `docs/architecture/CAMPAIGN_MODULE_BASELINE.md` — **protected Campaign baseline** (IA initiative CLOSED)  
- `docs/architecture/PRODUCT_UX_STANDARDS.md` — platform UX standards (Campaign = canonical)  
- `docs/architecture/CAMPAIGN_INFORMATION_ARCHITECTURE.md` — Campaign List ↔ Workspace IA  
- `docs/architecture/CAMPAIGN_WORKSPACE_UI_FREEZE.md` · `CAMPAIGN_WORKSPACE_UI_GUIDELINES.md` — Aurora freeze + extend rules  
- `docs/architecture/FINANCIAL_DISPLAY_STANDARD.md` — ISO money display platform-wide  
- `docs/architecture/CAMPAIGN_MODULE_TECHNICAL_DEBT.md` — Low non-blocking backlog  
- `docs/architecture/UNIFIED_MEDIA_PLAN_PLAN.md` — Media Plan SSOT  
- `docs/architecture/MEDIA_PLAN_VERSIONING.md` — business version vs audit  
- Publishing Calendar: Saturday–Friday calendar weeks; range from campaign start/end  
- `lib/media-plan` — Media Plan Engine  
- `docs/DISCOVERY_*` · `docs/PERFORMANCE_*` — discovery & perf contracts  
- Ops Center `/operations` — deployment/health SSOT  

## Campaign Module Baseline (protected · closed 2026-08-01)

Includes: Campaign IA · Workspace UI · Enterprise Tabs · Financial Display Standard · Deliverables selection · Persistent shell.  
**Extend only — no redesign** unless Critical usability + Product approval.  
Tip: `31c5a030` on `develop`.

## Thinkway Enterprise Platform Architecture v1.0 (frozen 2026-08-01)

- Package: `docs/architecture/platform-ux/` (01–12) **frozen**.
- Highest process SSOT: `12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md`.
- Definition: campaign-centric enterprise OS; one campaign; one lifecycle; stakeholder journeys on the same spine.
- Phase 1 complete: Business Process Navigation Foundation (protected baseline).
- Architecture-first work complete — functional delivery via capability specs only.
- Every future ADR / capability / proposal must include Platform Architecture Compliance (incl. BPN reuse).

## Product UX Standards

Campaign is the canonical implementation for: workspace architecture, navigation/information hierarchy, KPI presentation, workspace summaries, Enterprise Tabs, financial presentation, status badges, action placement, progressive disclosure.

## Campaign Workspace Lifecycle OS (protected · 2026-08-01)

Protected implementation baseline for Architecture v1.0. Living Campaign Object · State Strip · ERP Process Rail · Portfolio intelligence · Next Action journey.  
**Extend only** — future capabilities must not modify its navigation philosophy.  
Regression: `npm run test:campaign-workspace-lifecycle-os`.

## Next functional priority

1. **Active:** Release 2.2a Planning Board — review Capability Spec **and** Product Review together → approve → **then** implement (Planning stage; inherits Campaign Workspace Lifecycle OS)  
2. Media Plan Copilot (R2.2b)  
3. Client Collaboration · Vendor · Creator journeys  
4. Reporting Hub · Notifications · Enterprise Analytics  
5. Migration Phase 2+ only if Product authorizes (no new architecture by default)  

## Platform navigation standard

- **Enterprise Tabs** (`components/workspace/enterprise-tabs.tsx` + `app/styles/enterprise-tabs.css`) — only approved workspace tab rail.

## Financial Display Standard

- ISO codes only: `EGP 1,235,561` (KPI) · `EGP 1,235,561.00` (detail)
- Canonical: `lib/finance/currency-format.ts`

## Ops & workers

- Redis + BullMQ for discovery/performance queues.
- Heartbeat key: `thinkway:worker:discovery:heartbeat`.
- Local worker: `npm run discovery:worker:dev`. Production worker: separate host (e.g. Railway), `npm run discovery:worker`.
- Hosted Dev and Prod must use **separate** `REDIS_URL` values.

## Roles (high level)

Admin / Director / Manager / Account Manager / Finance / Data Entry — enforce via RLS + app auth matrix (reference §6).
