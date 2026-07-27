# Prompt Summary — Current Sprint

**Branch focus:** `feature/unified-media-plan` (from `develop`).  
**Prior stash on `main`:** `WIP commercial CRM before unified-media-plan` — restore separately; do not mix with Media Plan work.

## Active: Unified Media Plan (Phase 0)

- Architecture: `docs/architecture/UNIFIED_MEDIA_PLAN_PLAN.md`
- Engine SSOT: `lib/media-plan` — immutable Current Approved Baseline, ≤1 Working Draft, Actual/Remaining from baseline only, Outputs must not mutate schedule
- Tests: `npm run test:media-plan-engine`
- Next: Phase 1 — persist version pointers on Campaign Object; Campaign full-page workspace reusing Studio `MediaPlanCalendar`

## Done earlier

- Development-first Git workflow restored; CI on `develop`
- Dual-deploy / Ops Center / Dev–Prod Supabase split docs

## Open / blocked

1. GitHub branch protection (UI)
2. Production `REDIS_URL` / dedicated Dev Redis / DNS as needed
3. Do **not** merge to `main` or deploy Production without explicit approval

## Working agreement

`develop` → `feature/*` → `develop` → QA → `main` → approved Production. Never develop on `main`.
