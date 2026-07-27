# Prompt Summary — Current Sprint

**Branch focus:** `feature/unified-media-plan` (from `develop`).  
**Prior stash on `main`:** `WIP commercial CRM before unified-media-plan` — restore separately; do not mix with Media Plan work.

## Active: Unified Media Plan (Phase 2 complete → Phase 3/4 next)

- Architecture: `docs/architecture/UNIFIED_MEDIA_PLAN_PLAN.md`
- Phase 1 write paths: `docs/architecture/UNIFIED_MEDIA_PLAN_PHASE1_WRITE_PATHS.md`
- Phase 2 report: `docs/architecture/UNIFIED_MEDIA_PLAN_PHASE2_REPORT.md`
- Route: `/campaigns/[id]/media-plan` — Original/Actual/Remaining via shared `MediaPlanCalendar`
- Tests: `npm run test:media-plan-phase1` · `npm run test:media-plan-phase2`
- Next: Timeline events + Client Portal Original read-only (Phase 4)

## Done earlier

- Development-first Git workflow restored; CI on `develop`
- Dual-deploy / Ops Center / Dev–Prod Supabase split docs

## Open / blocked

1. GitHub branch protection (UI)
2. Production `REDIS_URL` / dedicated Dev Redis / DNS as needed
3. Do **not** merge to `main` or deploy Production without explicit approval

## Working agreement

`develop` → `feature/*` → `develop` → QA → `main` → approved Production. Never develop on `main`.
