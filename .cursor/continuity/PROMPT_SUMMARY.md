# Prompt Summary — Current Sprint

**Branch focus:** `feature/unified-media-plan` (from `develop`).  
**Prior stash on `main`:** `WIP commercial CRM before unified-media-plan` — restore separately; do not mix with Media Plan work.

## Active: Unified Media Plan (Phase 1 complete → Phase 2 next)

- Architecture: `docs/architecture/UNIFIED_MEDIA_PLAN_PLAN.md`
- Write-path report: `docs/architecture/UNIFIED_MEDIA_PLAN_PHASE1_WRITE_PATHS.md`
- Engine: `lib/media-plan` + Studio bridge `features/campaign-outputs/media-plan-mutations.ts`
- All Studio schedule writes route through Engine; audit test enforces no direct assigns
- Tests: `npm run test:media-plan-phase1`
- Next: Phase 2 — Campaign full-page Media Plan workspace reusing Studio calendar

## Done earlier

- Development-first Git workflow restored; CI on `develop`
- Dual-deploy / Ops Center / Dev–Prod Supabase split docs

## Open / blocked

1. GitHub branch protection (UI)
2. Production `REDIS_URL` / dedicated Dev Redis / DNS as needed
3. Do **not** merge to `main` or deploy Production without explicit approval

## Working agreement

`develop` → `feature/*` → `develop` → QA → `main` → approved Production. Never develop on `main`.
