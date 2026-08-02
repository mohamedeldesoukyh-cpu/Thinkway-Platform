# Prompt Summary — Current Sprint

**Branch focus:** `develop` (synced with `origin/develop`).  
**Active initiative:** **Release 2.3 — Campaign Planning Workspace** — start with Capability / UX / Spec / Compliance reviews · **no Campaign Workspace UX**  
**Must inherit:** Campaign Workspace Baseline **v1.3** · Platform Bulk Operations Framework · BPN · Architecture v1.0.

**Capability completeness gates:** Bulk · Background · AI-ready · Operational effort · **Idempotent execution** (all five required).

**Platform Bulk Framework:** `docs/architecture/PLATFORM_BULK_OPERATIONS_FRAMEWORK.md` — Vendor IO consumer (R2.2d); reliability + single-refresh + idempotency (R2.2d.1).

**Enterprise Document Lifecycle:** `docs/architecture/ENTERPRISE_DOCUMENT_LIFECYCLE.md` · `lib/document-lifecycle/` (R2.2d.2 Option D) — reason codes · business change events · Business State ≠ Document State · AI-ready.

**Gate docs (Planning — retargeted as R2.3):**  
- `docs/capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md`  
- `docs/capabilities/PLANNING_BOARD_CAPABILITY_REVIEW.md`  

**Prior stash on `main`:** `WIP commercial CRM before unified-media-plan` — restore separately; do not mix with Media Plan work.

## Media Planning v1 — RELEASED TO PRODUCTION

- **Canonical SSOT:** `docs/architecture/MEDIA_PLANNING_V1_PRODUCTION_READINESS.md`
- Release commit on `main`/`develop`: `e1624adb` (`[deploy-production]`)
- Prod DB (`ienowhwfyxoqtzbgltno`): Media Plan portal SELECT policies + Commercial CRM completion/payment readiness applied
- **Feature freeze:** no new Media Planning work unless requirements are approved
- Verify: Ops Center Production ↔ `ienowhwfyxoqtzbgltno`; smoke Studio/Campaign/Portal Media Plan

## Done earlier

- Development-first Git workflow restored; CI on `develop`
- Dual-deploy / Ops Center / Dev–Prod Supabase split docs

## Open / blocked

1. GitHub branch protection (UI)
2. Production `REDIS_URL` / dedicated Dev Redis / DNS as needed
3. Do **not** merge to `main` or deploy Production without explicit approval

## Campaign Workspace Baseline v1.3 — FROZEN (Release 2.2c · 2026-08-01)

- **Canonical:** `docs/architecture/CAMPAIGN_WORKSPACE_BASELINE_V1.3.md`
- **Freeze tip:** `84ef254c` — `feat(campaign): Decision Center business narrative and operational compliance`
- **Historical:** v1.2 · v1.1 · v1.0 superseded
- **Class:** Protected implementation baseline — **Maintenance Mode**
- **Includes:** Executive dependency chain · three severities · Vendor IO = Operational Compliance (never pins progression) · collapsible Decision Center · lean story cards · progressive registers · deep-links
- **Rule:** No Campaign Workspace redesign / further UX refinement without Architecture Reopen
- **Permitted:** bug · perf · a11y · copy · additional deep-links · lifecycle extensions that preserve baseline
- **Compliance:** `PLATFORM_ARCHITECTURE_COMPLIANCE.md` invariants 1–12 (v1.3)
- **Regression:** `npm run test:campaign-workspace-lifecycle-os`
- **Technical debt (backlog):** enterprise browser soak · Portfolio/Notifications deep-link adoption · optional `?audit=` · Optimization Opportunity wiring

## Active — Release 2.3 Campaign Planning Workspace

- **Status:** Review gate — Business Capability → Product UX → Spec approval → Architecture Compliance → Implementation
- **Role:** Planning stage of the Campaign Lifecycle (inherits Campaign Workspace Baseline **v1.3**)
- **Must not** introduce new navigation philosophy; extend Lifecycle OS + BPN only
- Spec must include operational effort reduction (eliminated / simplified / human)

## Enterprise Ops & Finance Architecture — APPROVED & FROZEN (2026-07-30)

- Package: `docs/architecture/ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md`
- **Release 2.1:** Production complete · Tag `v2.1.0`
- **Release 2.2:** Deployed · Closure PAUSED (OPS-EMAIL) — see release package

## Campaign Module Baseline — CLOSED (2026-08-01)

- **Protected baseline:** `docs/architecture/CAMPAIGN_MODULE_BASELINE.md`
- Tip: `31c5a030` on `develop`

## Thinkway Enterprise Platform Architecture v1.0 — FROZEN (2026-08-01)

- **Milestone:** `docs/architecture/THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md`
- **BPN Foundation:** protected
- **Preserves:** Campaign Workspace Baseline v1.3 · Campaign Module Baseline · BPN · all business logic / APIs / DB

## Working agreement

`develop` → `feature/*` → `develop` → QA → `main` → approved Production. Never develop on `main`.
