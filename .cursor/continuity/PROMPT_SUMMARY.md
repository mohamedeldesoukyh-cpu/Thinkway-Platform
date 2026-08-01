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
- **Quotation avatars (Prod repaired 2026-07-30):** Root cause was service_role-only storage + dead IG CDN/OG. Shipped admin+Apify durable repair (`35b4c425`); Prod deploy `dpl_3NcQrhZ23VGgKm7L7D7GMdcvzGHK`. Data repair: 6/6 QT-2026-0009 CDN-only creators → durable `creator-avatars` (incl. `recipeswithmashael`); idempotent re-run skipped all 6.
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
- **Production:** flag ON · Workspace live · smoke Pass (`08a94855` docs evidence)
- **Polish shipped:** Commercial Workspace + lifecycle now reuse exact `quotation-creator-card` SSOT classes (Creators grid shells, green/orange/missing-cost, avatars, shortlist status pills)
- **Deferred on Prod:** Finance Lock / linked SSOT sync (no linked Prod fixtures during enablement smoke)
- **Open Low:** DEF-CW-02 Creators chip · DEF-CW-03 200+ soak (backlog)

## Productivity & Navigation UX Sprint (Shipped to Production 2026-07-30)

- **Release commit:** `dfb3ef8c` on `main`/`develop` · Production `app.thinkwaymedia.com` · `dpl_3LkecZp8bkkk3iZSQA7ByHSQeAAP`
- **Prod Supabase:** `ienowhwfyxoqtzbgltno` (aligned) · 6 migrations applied · R2.0 flag OFF
- **UAT:** `docs/architecture/PRODUCTIVITY_NAVIGATION_UX_UAT.md` · Feature freeze remains for post-release polish only
- **Backlog:** history search/export · keyboard conventions · richer nav context · history deep links

## Enterprise Ops & Finance Architecture — APPROVED & FROZEN (2026-07-30)

- Package: `docs/architecture/ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md`
- Thesis: complete/harden existing ERP — no redesign
- Decisions locked: multi Media Plans/campaign; CIO amendment chain; configurable milestones; credit notes; 1 VIO/creator; Convert enable after Prod smoke; post-start Commercial Revision → R3; Enterprise Timeline
- **Release 2.1:** Media Plan ↔ Assignment Hardening — **PRODUCTION COMPLETE (2026-07-31)**
- Tag `v2.1.0` · tip `35086130` · Prod deploy `dpl_7STrhfLRw3utjkVmRwr6Kj817m1e` · `app.thinkwaymedia.com` · Prod Supabase `ienowhwfyxoqtzbgltno`
- Commits: `9d25a65f` · `7eaf219` · `388bab6c` · docs `35086130`
- Package/UAT archived under `docs/architecture/RELEASE_2_1_*`
- Redis latency warning on Prod Ops Center remains INFRA (not R2.1 defect)
- **Release 2.2 — Deployed · Closure PAUSED (OPS-EMAIL)** — Product ratified 2026-07-31 (unchanged)
- Prod tip `db7c8064` · `dpl_GemydYz7E7J5BFwjfoqPeok8NpzW` · `app.thinkwaymedia.com` · Supabase `ienowhwfyxoqtzbgltno`
- Deploy ✅ · DB ✅ · Partial smoke ✅ · OPS-EMAIL ⏸️ · Closure ⏸️ · `v2.2.0` ⛔ · Production Complete ⛔
- Package: [`RELEASE_2_2_PRODUCTION_PACKAGE.md`](../../docs/architecture/RELEASE_2_2_PRODUCTION_PACKAGE.md) — E1–E7 evidence required before tag/closure
- Standing by: Prod email config → Product pre-authorized resume: E1–E7 → remaining smoke → evidence → `v2.2.0` → Production Complete → reopen **2.2a Planning Board** (pause + remediate if any E-check fails)
- Suite: `npm run test:release-2-2` **17/17**

## Campaign Module Baseline — CLOSED (2026-08-01)

- **Initiative CLOSED permanently:** Campaign Information Architecture
- **Protected baseline:** `docs/architecture/CAMPAIGN_MODULE_BASELINE.md`
- **Product UX standards:** `docs/architecture/PRODUCT_UX_STANDARDS.md` (Campaign = canonical)
- **Low debt (non-blocking):** `docs/architecture/CAMPAIGN_MODULE_TECHNICAL_DEBT.md`
- **Tip:** `31c5a030` on `develop` — no further Campaign redesign unless Critical + Product approval
- **Next (functional delivery):** Planning Board (2.2a) → Media Plan Copilot (2.2b) → Vendor IO Enterprise Completion → Reporting Hub → Notifications → Enterprise Analytics
- **No Production deploy** without explicit approval

## Thinkway Enterprise Platform Architecture v1.0 — FROZEN (2026-08-01)

- **Milestone:** `docs/architecture/THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md`
- **BPN Foundation (protected):** `docs/architecture/BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md` — canonical navigation
- **Compliance gate:** lifecycle · journeys · BPN components reused · no new nav — `PLATFORM_ARCHITECTURE_COMPLIANCE.md`
- **Package frozen:** `docs/architecture/platform-ux/` (01–12) — no architecture/UX redesign without formal reopen
- **Architecture-first work:** Complete · Migration Phase 1 complete (`b8e09927`)
- **Next gate:** Planning Board Capability Spec — `docs/capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md` (awaiting approval; not architecture)
- **After capability approval:** Release 2.2a implementation → 2.2b Copilot → Client/Vendor/Creator journeys → Reporting → Notifications → Analytics
- **Preserves:** Campaign Baseline · BPN · Enterprise Tabs · Financial Display · Deliverables · all business logic / APIs / DB

## IO approval email experience (Preview testing on develop)

- Simplified Client/Vendor IO send emails: Campaign Name, Brand Name, Campaign Duration, Agreed Amount + blue **Approve** CTA + legal notice; PDF remains SSOT
- One-click approval pages (`/io-approval/client|vendor`) validate token and approve immediately (no review form)
- **Idempotent approve:** repeat click → `Already Approved` (no duplicate emails / timeline / notifications)
- Friendly outcomes: Already Approved · Expired · Superseded · Link Unavailable
- Confirmation emails to approver + `traffic@thinkwaymedia.com` after first success only
- Dev migrations applied on `hsxrewjcbvmbkqdlzjhs`: `20260731160000_*`, `20260731161000_io_approval_idempotent.sql` (Prod not applied)
- Next: Preview E2E testing — **no Production deploy yet**

## Media Plan PDF calendar fit (shipped to Production)

- Commit `869b0283` · Prod `dpl_941j3warcwr2gcQ4yC3FM4hva7n8` · `app.thinkwaymedia.com`
- Standard download keeps **same multi-week calendar as preview** (not one week per page)
- Fix: `sizeAutoHeightPages` in `vendor-io-pdf` measures `.calendar-preview-page` / `.deadlines-preview-page` and emits matching `@page` sizes so Chromium does not clip
- **Avatar follow-up (all PDF types):** `inlineRemoteImagesInHtml` runs in `renderHtmlToPdf` for every HTML→PDF; media plan also resolves durable `primary_avatar_url` by creatorId; quotation/shortlist/proposal embeds use admin supabase

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
