# Prompt Summary — Current Sprint

**Branch focus:** `feature/unified-media-plan` (from `develop`).  
**Prior stash on `main`:** `WIP commercial CRM before unified-media-plan` — restore separately; do not mix with Media Plan work.

## Media Planning v1 — COMPLETE / FROZEN

- **Canonical SSOT:** `docs/architecture/MEDIA_PLANNING_V1_PRODUCTION_READINESS.md`
- Phase reports + architecture plan: historical (superseded for release; not deleted)
- Branch: `feature/unified-media-plan` — final docs commit is last v1 change unless bugs found
- Routes: `/campaigns/[id]/media-plan` · `/client-portal/campaigns/[id]/media-plan`
- Tests: `npm run test:media-plan-engine|phase1|phase2|phase3|phase4`
- Migration (Dev applied; Prod not): `20260727120000_campaign_objects_client_portal_select.sql`
- **Feature freeze:** no new Media Planning work unless requirements are approved
- Next: PR → `develop` → Dev QA → explicit Production approval

## Done earlier

- Development-first Git workflow restored; CI on `develop`
- Dual-deploy / Ops Center / Dev–Prod Supabase split docs

## Open / blocked

1. GitHub branch protection (UI)
2. Production `REDIS_URL` / dedicated Dev Redis / DNS as needed
3. Do **not** merge to `main` or deploy Production without explicit approval

## Working agreement

`develop` → `feature/*` → `develop` → QA → `main` → approved Production. Never develop on `main`.
