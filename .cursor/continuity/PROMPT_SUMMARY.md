# Prompt Summary — Current Sprint

**Branch focus:** `develop` (Release 2.0 Phase 1 soak complete).  
**Release 2.0 MR:** https://github.com/mohamedeldesoukyh-cpu/Thinkway-Platform/pull/3 (`develop` → `main`) — includes Media Plan versioning + Sat–Fri Publishing Calendar.  

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

## Media Plan — assignment hydration (shipped on develop)

- Empty slate seeds from Assignments hierarchy on: Studio generate/regenerate, open Studio from campaign, Campaign Media Plan load
- Open Studio / sync auto-generates Media Plan when creators are seeded

## Publishing Calendar (Saturday–Friday)

- **Calendar-based**, not campaign-relative: weeks are **Sat → Fri**
- Range = first Saturday of week containing campaign start → last Friday of week containing campaign end
- Mid-week starts/ends still render that partial publishing week
- Week labels Week 1…N continue across months (no month restart)
- **Revise** on date change: recalculate range + rebind slots; preserve creators/strategy unless Regenerated
- Example: 15 Jul – 14 Aug 2026 → five weeks (11–17 Jul … 8–14 Aug)
- **Campaign Window (hard constraint):** Start–End is absolute; Generate/Revise rebalance into window; save rejects out-of-window slots (`media-plan-campaign-window.ts`)
- **Copilot end date:** `update_timeline` accepts start+end (e.g. “starting 24/07/2026 ending 23/08/2026”); stores `facts.campaignEndDate` and rebinds Publishing Calendar to that window (not duration-only derived end)
- **Published card colors:** Studio + Original Media Plan cards turn green (Live) / amber (Partial) from Performance `live_date` (`annotateMediaPlanExecutionStatus`)
- **Commercial SSOT Phases 1–4 done (feature-complete + freeze):** Commit `73b8e574` on `develop`; Dev migration applied (`hsxrewjcbvmbkqdlzjhs`); Production untouched. Formal UAT: `docs/architecture/COMMERCIAL_SSOT_UAT_SIGNOFF.md`. **No further Commercial SSOT features** — bug fixes only. After green UAT → RC tag (e.g. `v2.0.0-rc1`) then Production only with explicit approval. Spec: `docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md` (D-COMM). Tests: `npm run test:commercial-ssot-phase4`.
- **Deliverables Documentation Repository Phase 1 approved:** Docs/assets SSOT on `develop` (`01da502c`); Dev migration applied; Production untouched. UAT: `docs/architecture/DELIVERABLES_DOCUMENTATION_UAT.md` (include large-campaign perf). After green UAT → **freeze** (defect fixes only). Phase 2 backlog: Bulk Upload; portals later. Spec: `docs/architecture/DELIVERABLES_DOCUMENTATION_REPOSITORY.md`. Tests: `npm run test:deliverable-docs`.

## Media Plan Versioning (SSOT + domain aligned on develop)

- **SSOT:** `docs/architecture/MEDIA_PLAN_VERSIONING.md` (contract; code yields to spec)
- **Business Version ≠ Audit History** — separate fields (`versionLabel` / `history` vs `auditHistory`)
- **Approval is the version boundary** — Draft/Under Review edits stay on tip (e.g. v1.0) + audit; Approved immutable
- Leaving Approved: Revise → minor (`v1.1`); Regenerate → major (`v2.0`); Restore append-only
- Governance on each version: Status, Approved By/Date/Source, Approval Impact (`none` | `internal` | `client_reapproval`)
- AI: prefer Revise; ask if ambiguous; Regenerate only when explicit/strategic
- **Release gate:** revise-on-every-edit must not merge — domain tests enforce SSOT
- Intelligence Summary: Campaign Start / End / Duration only; Monday align internal
- Dock chat scroll CSS fix (local)

## Quotation Commercial Workspace (Feature Freeze · Production enabled)

- **Freeze:** 2026-07-30 — bug/perf/polish only; Phase 2 for new capabilities
- **UAT:** Pass with defects — `docs/architecture/QUOTATION_COMMERCIAL_WORKSPACE_UAT.md`
- **Production:** `7596931d` · `dpl_EUY8GwxngNnu4zh836yMzD1jepxy` · `app.thinkwaymedia.com` · Supabase aligned
- **Flag:** `NEXT_PUBLIC_QUOTATION_COMMERCIAL_WORKSPACE=true` on Production
- **Prod smoke:** ✅ Pass (TUNA V2) — open Workspace, bulk/health, undo, shared draft KPIs, discard, save toast
- **Deferred on Prod:** Finance Lock / linked SSOT sync (available Prod fixtures not campaign-linked)
- **Open Low:** DEF-CW-02 Creators chip · DEF-CW-03 200+ soak (backlog)

## Productivity & Navigation UX Sprint (Shipped to Production 2026-07-30)

- **Release commit:** `dfb3ef8c` on `main`/`develop` · Production `app.thinkwaymedia.com` · `dpl_3LkecZp8bkkk3iZSQA7ByHSQeAAP`
- **Prod Supabase:** `ienowhwfyxoqtzbgltno` (aligned) · 6 migrations applied · R2.0 flag OFF
- **UAT:** `docs/architecture/PRODUCTIVITY_NAVIGATION_UX_UAT.md` · Feature freeze remains for post-release polish only
- **Backlog:** history search/export · keyboard conventions · richer nav context · history deep links

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
- **Production (2026-07-30):** Schema migrations applied with full stack release `dfb3ef8c`; **`RELEASE_2_0_ASSIGNMENT_CONVERT` remains unset/OFF** on Production. Phase 2 still blocked until Product enables convert.

## Working agreement

`develop` → `feature/*` → `develop` → QA → `main` → approved Production. Never develop on `main`.
