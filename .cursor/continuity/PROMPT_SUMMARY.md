# Prompt Summary — Current Sprint

**Branch focus:** `develop` (Release 2.0 Phase 1 soak complete).  
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

- **Status:** Phase 1 **Development soak 100% green** (2026-07-28)
- **Soak plan:** `docs/release/2.0/DEVELOPMENT_SOAK_PLAN.md`
- **Readiness:** `docs/release/2.0/PRODUCTION_READINESS_REVIEW.md` — recommendation **Go** (flag-gated), Production deploy still needs explicit approval
- **Phase 2 blocked** until Phase 1 is Production-stable
- **Flag:** `RELEASE_2_0_ASSIGNMENT_CONVERT` **OFF by default**; Preview(`develop`) may be ON for soak only; keep Production unset/OFF until approved enablement
- **Convert soak:** QT-2026-0005 → TW-2026-0002 (2 Assignments, snapshot, pin, billing E2E VIO→INV→PAY)
- **Backfill soak:** Isolated Dev fixtures QT-2026-0019 → TW-2026-0003 via `scripts/soak-release-2-0-backfill-dev.mjs` (detect/dry-run/execute/idempotent)
- **No Production deploy executed.** No Phase 2.
- **Soak fix (unrelated to R2.0):** `/discovery/search` SSR crash from `get_discovery_search_taxonomy` statement timeout — soft-fail + Dev function timeout 30s (`3cb56e3f`)
- **Convert type×platform bug (fixed on develop, Dev data repaired):** `quotationDeliverablesToPlatforms` was copying every selected type onto every package platform. Now maps each type via `postTypePlatformKey` (native → home PF; `mirrored_*` → target PF). Repaired TW-2026-0005 (QT-2026-0009-V2) — 10 multi-PF lines incl. Eman. Script: `scripts/repair-assignment-types-from-quotation.ts`
- **Next action:** Seek explicit Production approval using PRODUCTION_READINESS_REVIEW.md (migration + deploy + keep flag OFF initially; include taxonomy timeout migration)

## Working agreement

`develop` → `feature/*` → `develop` → QA → `main` → approved Production. Never develop on `main`.
