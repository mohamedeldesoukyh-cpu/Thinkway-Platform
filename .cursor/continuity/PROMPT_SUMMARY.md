# Prompt Summary — Current Sprint

**Branch focus:** `feature/unified-media-plan` (from `develop`).  
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

## Media Plan hotfix (in progress on develop)

- Actual now includes Performance live dates even when approved baseline has 0 creators
- Empty Studio slate seeds creators from campaign assignment hierarchy on generate/regenerate + campaign Media Plan load
- TW-2026-0001 still needs Studio regenerate after deploy to persist creators into the draft tip

## Showcase PDF v2 (in progress on develop)

- Unified pagination engine: measure DOM → pack atomic blocks → fixed A4 **landscape** Page objects
- Preview iframe + PDF share the same HTML/runtime; Puppeteer waits for `data-sl-paginated=ready` then prints (no Chromium page-splitting layout)
- Key files: `shortlist-pagination-engine.ts`, `shortlist-page-geometry.ts`, template HTML/styles, `SHORTLIST_PDF_OPTIONS`

## Release 2.0 — Enterprise Campaign Lifecycle

- **Status:** Phase 1 foundation **complete** on `feature/release-2-0-lifecycle` — see `docs/release/2.0/PHASE_1_VALIDATION.md`
- **Dev migration applied** (`hsxrewjcbvmbkqdlzjhs`): provenance + `campaign_commercial_snapshots`
- **Convert engine:** `convertQuotationToAssignments` (Path A + Path B when quote linked)
- **UI:** Convert to Campaign dialog + Backfill wizard
- **Flag:** on for `development` surface; explicit env overrides; Production off by default
- **Next:** PR → develop → Dev soak; Production No-Go until approval
- **Out of Phase 1:** Media Plan / Performance / Billing refactors, Difference Engine

## Working agreement

`develop` → `feature/*` → `develop` → QA → `main` → approved Production. Never develop on `main`.
