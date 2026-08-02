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
- `docs/architecture/CAMPAIGN_WORKSPACE_BASELINE_V1.3.md` — **canonical protected Campaign Workspace Lifecycle OS** (Business Narrative & Operational Compliance) — Maintenance Mode; no redesign without Architecture Reopen
- `docs/architecture/CAMPAIGN_WORKSPACE_BASELINE_V1.2.md` — historical (superseded by v1.3)
- `docs/architecture/CAMPAIGN_WORKSPACE_BASELINE_V1.1.md` · `CAMPAIGN_WORKSPACE_BASELINE_V1.md` — historical
- `docs/architecture/PLATFORM_ARCHITECTURE_COMPLIANCE.md` — mandatory compliance (lifecycle · journeys · BPN reuse · Campaign Workspace v1.3 invariants · operational effort gate · no new nav)
- `docs/architecture/CAMPAIGN_WORKSPACE_BASELINE_V1.3.md` — canonical Campaign Workspace OS baseline (executive Decision Center · three severities · Vendor IO operational compliance)
- `docs/architecture/PLATFORM_BULK_OPERATIONS_FRAMEWORK.md` — official bulk framework (`components/workspace/bulk-operations/`); Vendor IO first production consumer (R2.2d / 2.2d.1); gates: bulk · background · AI-ready · effort · idempotent
- `docs/architecture/PLATFORM_CAPABILITY_REGISTRY.md` — permanent registry; Document Lifecycle + Change Impact in **Maintenance Mode** (initiative CLOSED; freeze tip `449fd5c0`)
- `docs/architecture/ENTERPRISE_DOCUMENT_LIFECYCLE.md` — Document Lifecycle **Maintenance Mode** (`lib/document-lifecycle/`); state transitions only
- `docs/architecture/ENTERPRISE_CHANGE_IMPACT_ENGINE.md` — Change Impact **Maintenance Mode** (`lib/change-impact/`); entry `applyBusinessChangeImpact` only; Quotation/PO/Invoice/Contract/Report must extend — never parallel
- `docs/capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md` — **active** R2.3 Campaign Planning Workspace capability spec (review gate)
- `docs/capabilities/PLANNING_BOARD_CAPABILITY_REVIEW.md` — **active** R2.3 functional capability review pack
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

1. **Active:** Release 2.3 Campaign Planning Workspace — Capability / UX / Spec / Compliance reviews → implement (Planning stage; inherits Campaign Workspace Baseline **v1.3**; operational effort gate required)  
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
