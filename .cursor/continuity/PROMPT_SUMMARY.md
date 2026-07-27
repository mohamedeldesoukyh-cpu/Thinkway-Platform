# Prompt Summary — Current Sprint

**Branch focus:** `feature/unified-media-plan` (from `develop`).  
**Prior stash on `main`:** `WIP commercial CRM before unified-media-plan` — restore separately; do not mix with Media Plan work.

## Active: Unified Media Plan (Phases 0–4 complete on feature branch)

- Architecture: `docs/architecture/UNIFIED_MEDIA_PLAN_PLAN.md`
- Phase 3: Timeline + Compare + Approval — `UNIFIED_MEDIA_PLAN_PHASE3_REPORT.md`
- Phase 4: Client Portal Original + Approve / Request Changes / Reject — `UNIFIED_MEDIA_PLAN_PHASE4_REPORT.md`
- Routes: `/campaigns/[id]/media-plan` · `/client-portal/campaigns/[id]/media-plan`
- Tests: `npm run test:media-plan-engine|phase1|phase2|phase3|phase4`
- Branch: `feature/unified-media-plan` (rebased on `develop`)
- Migration (Dev applied): `20260727120000_campaign_objects_client_portal_select.sql`
- Next: QA / merge to develop; baseline snapshot refinement only if gaps appear

## Done earlier

- Development-first Git workflow restored; CI on `develop`
- Dual-deploy / Ops Center / Dev–Prod Supabase split docs

## Open / blocked

1. GitHub branch protection (UI)
2. Production `REDIS_URL` / dedicated Dev Redis / DNS as needed
3. Do **not** merge to `main` or deploy Production without explicit approval

## Working agreement

`develop` → `feature/*` → `develop` → QA → `main` → approved Production. Never develop on `main`.
